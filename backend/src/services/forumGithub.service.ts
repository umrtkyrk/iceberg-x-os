import { badRequest } from '../utils/http';

/**
 * Recent activity of a GitHub repository for a private room's side panel: pull requests, commits on the
 * default branch and pushes. Only api.github.com is ever contacted, with the repository path validated
 * and encoded. Results are cached per repository so polling rooms stay well under GitHub's rate limits.
 * Set GITHUB_TOKEN to read private repositories or to raise the limit (60 requests/hour without it).
 */
const REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const CACHE_MS = 60_000, ERROR_CACHE_MS = 30_000;

export interface GithubActivity {
  repo: string; url: string; fetched_at: string; error: string | null;
  pulls: { number: number; title: string; state: 'open' | 'closed' | 'merged' | 'draft'; author: string | null; url: string; updated_at: string }[];
  commits: { sha: string; message: string; author: string | null; url: string; date: string }[];
  pushes: { actor: string | null; branch: string; commits: number | null; date: string }[];
}

/** Accepts `owner/name` or a github.com URL; returns `owner/name`, or null for an empty value. */
export function parseGithubRepo(value: unknown): string | null {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'string' || value.length > 200) throw badRequest('Enter a GitHub repository as owner/name.');
  let repo = value.trim().replace(/\.git$/i, '').replace(/\/+$/, '');
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+\/[^/?#]+)/i.exec(repo);
  if (url) repo = url[1];
  if (!REPO.test(repo) || repo.endsWith('/.') || repo.endsWith('/..')) throw badRequest('Enter a GitHub repository as owner/name.');
  return repo;
}

const cache = new Map<string, { until: number; data: GithubActivity }>();

async function github<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'iceberg-x-portal',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Object.assign(new Error('GitHub request failed'), { status: response.status });
  return response.json() as Promise<T>;
}

type ApiPull = { number: number; title: string; state: string; draft?: boolean; merged_at: string | null; user: { login: string } | null; html_url: string; updated_at: string };
type ApiCommit = { sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } | null }; author: { login: string } | null };
type ApiEvent = { type: string; actor: { login: string } | null; created_at: string; payload: { ref?: string; size?: number } };

export async function githubActivity(repo: string): Promise<GithubActivity> {
  const cached = cache.get(repo);
  if (cached && cached.until > Date.now()) return cached.data;
  const path = '/repos/' + repo.split('/').map(encodeURIComponent).join('/');
  const base: GithubActivity = { repo, url: `https://github.com/${repo}`, fetched_at: new Date().toISOString(), error: null, pulls: [], commits: [], pushes: [] };
  let data: GithubActivity;
  try {
    const [pulls, commits, events] = await Promise.all([
      github<ApiPull[]>(`${path}/pulls?state=all&sort=updated&direction=desc&per_page=5`),
      github<ApiCommit[]>(`${path}/commits?per_page=5`).catch(error => { if (error.status === 409) return []; throw error; }), // 409: empty repository
      github<ApiEvent[]>(`${path}/events?per_page=30`).catch(() => [] as ApiEvent[]),
    ]);
    data = { ...base,
      pulls: pulls.map(pull => ({ number: pull.number, title: pull.title, author: pull.user?.login || null, url: pull.html_url, updated_at: pull.updated_at,
        state: pull.merged_at ? 'merged' : pull.state === 'closed' ? 'closed' : pull.draft ? 'draft' : 'open' })),
      commits: commits.map(commit => ({ sha: commit.sha.slice(0, 7), message: commit.commit.message.split('\n')[0].slice(0, 200),
        author: commit.author?.login || commit.commit.author?.name || null, url: commit.html_url, date: commit.commit.author?.date || '' })),
      pushes: events.filter(event => event.type === 'PushEvent').slice(0, 5).map(event => ({ actor: event.actor?.login || null,
        branch: (event.payload.ref || '').replace(/^refs\/heads\//, ''), commits: typeof event.payload.size === 'number' ? event.payload.size : null, date: event.created_at })),
    };
  } catch (error) {
    const status = (error as { status?: number }).status;
    // Raw GitHub responses are never passed to the client.
    data = { ...base, error: status === 404 ? 'Repository not found, or it is private and the portal has no access to it.'
      : status === 403 || status === 429 ? 'GitHub rate limit reached. Activity will refresh in a few minutes.'
        : 'GitHub activity is unavailable right now.' };
  }
  cache.set(repo, { until: Date.now() + (data.error ? ERROR_CACHE_MS : CACHE_MS), data });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return data;
}
