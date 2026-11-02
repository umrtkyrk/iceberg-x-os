// Keep old notification URLs usable while generating English URLs for new links.
export function forumLocation(params: URLSearchParams) {
  const raw = Number(params.get('page'));
  return {
    topic: params.get('topic') || params.get('konu'),
    reply: params.get('reply') || params.get('yanit'),
    page: Number.isInteger(raw) && raw > 0 && raw < 100000 ? raw : 1,
  };
}

export function forumPageParams(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  // A notification target resolves its own page. Remove it when browsing other pages.
  next.delete('reply'); next.delete('yanit');
  next.set('page', String(page));
  return Object.fromEntries(next);
}

// Search and filter changes stay in the current list context and start at page one.
export function forumListParams(params: URLSearchParams, patch: Record<string, string | undefined>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') next.delete(key);
    else next.set(key, value);
  }
  for (const key of ['topic', 'konu', 'reply', 'yanit', 'page']) next.delete(key);
  if (next.get('view') === 'all') next.delete('view');
  return Object.fromEntries(next);
}

export function forumSearchParams(params: URLSearchParams, query: string, topicCategory?: string) {
  const patch: Record<string, string | undefined> = { q: query.trim() };
  if (['profile', 'categories', 'reports'].includes(params.get('view') || '')) patch.view = undefined;
  if (topicCategory !== undefined) patch.category = topicCategory;
  return forumListParams(params, patch);
}

export function forumReadStatus(lastActivity: string, readAt?: string) {
  return !readAt ? 'New' : new Date(lastActivity) > new Date(readAt) ? 'Unread' : null;
}
