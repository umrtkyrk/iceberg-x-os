import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
const model = ts.transpileModule(readFileSync(new URL('../src/pages/forum/forumModel.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { forumLocation, forumPageParams, forumReadStatus } = await import('data:text/javascript;base64,' + Buffer.from(model).toString('base64'));

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
test('read markers distinguish unseen, newly active and already read topics', () => {
  assert.equal(forumReadStatus('2026-11-02T10:00:00Z'), 'New');
  assert.equal(forumReadStatus('2026-11-02T10:00:00Z', '2026-11-02T09:00:00Z'), 'Unread');
  assert.equal(forumReadStatus('2026-11-02T10:00:00Z', '2026-11-02T10:00:00Z'), null);
});
test('forum CSS cannot style portal Markdown or controls outside the forum', () => {
  const css = postcss.parse(readFileSync(new URL('../src/pages/forum/talks.css', import.meta.url), 'utf8'));
  css.walkRules(rule => { for (const selector of rule.selectors) assert.ok(selector.startsWith('.cube-forum'), selector); });
});
