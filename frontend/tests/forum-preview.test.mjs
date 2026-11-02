import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
const model = ts.transpileModule(readFileSync(new URL('../src/pages/forum/forumModel.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { forumLocation, forumPageParams, forumListParams, forumSearchParams, forumReadStatus } = await import('data:text/javascript;base64,' + Buffer.from(model).toString('base64'));

test('current and legacy notification URLs resolve the topic and exact reply', () => {
  assert.deepEqual(forumLocation(new URLSearchParams('konu=t&yanit=r')), { topic: 't', reply: 'r', page: 1 });
  assert.deepEqual(forumLocation(new URLSearchParams('topic=new&konu=old&reply=new-r&yanit=old-r&page=2')), { topic: 'new', reply: 'new-r', page: 2 });
  for (const page of ['-1', '0', '1.2', '100000', 'NaN']) assert.equal(forumLocation(new URLSearchParams({ page })).page, 1);
});
test('manual pagination releases a notification target and preserves filters', () => {
  const params = new URLSearchParams('topic=t&reply=r&yanit=old&category=help&quest=q');
  assert.deepEqual(forumPageParams(params, 3), { topic: 't', category: 'help', quest: 'q', page: '3' });
  assert.equal(params.get('reply'), 'r');
});

test('search within a community preserves quest, mission and feed filters and resets pagination', () => {
  const params = new URLSearchParams('category=help&quest=quest-a&mission=mission-b&view=saved&sort=newest&page=4&q=old');
  assert.deepEqual(forumListParams(params, { q: 'session expiry' }), {
    category: 'help', quest: 'quest-a', mission: 'mission-b', view: 'saved', sort: 'newest', q: 'session expiry',
  });
  assert.equal(params.get('q'), 'old');
  assert.equal(params.get('page'), '4');
});

test('clearing one filter leaves the other filters intact', () => {
  const params = new URLSearchParams('category=help&quest=quest-a&mission=mission-b&view=following&q=React&page=2');
  assert.deepEqual(forumListParams(params, { quest: '', q: undefined }), {
    category: 'help', mission: 'mission-b', view: 'following',
  });
  assert.equal(params.get('quest'), 'quest-a');
  assert.equal(params.get('q'), 'React');
});

test('list navigation drops current and legacy notification targets even if patched back in', () => {
  const params = new URLSearchParams('topic=t&konu=old&reply=r&yanit=old-r&page=5&category=help&view=all');
  assert.deepEqual(forumListParams(params, { sort: 'newest', reply: 'another', page: '9' }), {
    category: 'help', sort: 'newest',
  });
  assert.equal(params.get('reply'), 'r');
  assert.equal(params.get('view'), 'all');
});
test('topic search leaves settings and moderation views while retaining available context', () => {
  for (const view of ['profile', 'categories', 'reports']) {
    const params = new URLSearchParams({ view, category: 'help', quest: 'quest-a', page: '3' });
    assert.deepEqual(forumSearchParams(params, '  token expiry  '), {
      category: 'help', quest: 'quest-a', q: 'token expiry',
    });
    assert.equal(params.get('view'), view);
    assert.equal(params.get('page'), '3');
    assert.equal(params.has('q'), false);
  }
});

test('search preserves each discussion list mode, including saved and following', () => {
  for (const view of ['saved', 'following', 'unanswered', 'solved', 'index']) {
    const params = new URLSearchParams({ view, category: 'help', sort: 'newest' });
    assert.deepEqual(forumSearchParams(params, '  React  '), {
      view, category: 'help', sort: 'newest', q: 'React',
    });
  }
  assert.deepEqual(forumSearchParams(new URLSearchParams('view=saved&q=React'), '   '), { view: 'saved' });
});

test('search from a topic uses its community and removes stale notification and page parameters', () => {
  const params = new URLSearchParams('topic=t&reply=r&konu=old&yanit=old-r&page=2');
  assert.deepEqual(forumSearchParams(params, '  API  ', 'help'), { q: 'API', category: 'help' });
  assert.equal(params.get('topic'), 't');
  assert.equal(params.get('reply'), 'r');
  assert.equal(params.has('category'), false);
});

test('read markers distinguish unseen, newly active and already read topics', () => {
  assert.equal(forumReadStatus('2026-11-02T10:00:00Z'), 'New');
  assert.equal(forumReadStatus('2026-11-02T10:00:00Z', '2026-11-02T09:00:00Z'), 'Unread');
  assert.equal(forumReadStatus('2026-11-02T10:00:00Z', '2026-11-02T10:00:00Z'), null);
});
test('forum CSS cannot style portal Markdown or controls outside the forum', () => {
  const css = postcss.parse(readFileSync(new URL('../src/pages/forum/talks.css', import.meta.url), 'utf8'));
  css.walkRules(rule => { for (const selector of rule.selectors) assert.ok(selector.startsWith('.cube-forum') || selector.startsWith(':where(.cube-forum) ' ), selector); });
});
