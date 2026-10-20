import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
const model = ts.transpileModule(readFileSync(new URL('../src/pages/forum/previewModel.ts', import.meta.url), 'utf8'), { compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020} }).outputText;
const { sanitisePreferences, parseStored, canStartTopic } = await import('data:text/javascript;base64,' + Buffer.from(model).toString('base64'));
import { initialTopics } from '../src/pages/forum/demo-data.js';

test('preferences retain only unique earned badges, in chosen order, up to three', () => {
  assert.deepEqual(sanitisePreferences({badgeIds:['b','a','b','foreign','c','d'], signature:'hello', role:'ADMIN'}, ['a','b','c','d']), {badgeIds:['b','a','c'],signature:'hello'});
});
test('invalid preferences cannot inject identity or unearned badges', () => {
  assert.deepEqual(sanitisePreferences({id:'another-person', badgeIds:[null,3,'other'],signature:null}, []),{badgeIds:[],signature:''});
  assert.equal(sanitisePreferences({signature:'x'.repeat(200)},[]).signature.length,140);
});
test('corrupt or wrongly shaped storage falls back to the design seed', () => {
  const sample=[{id:'topic',title:'Title',replies:[{body:'Reply'}]}];
  for(const raw of ['{','null','{}','[null]','[{"id":"x"}]']) assert.deepEqual(parseStored(raw,sample),sample);
  assert.deepEqual(parseStored('["first","second"]',[]),['first','second']);
});
test('announcements offer compose only to portal staff; unknown roles cannot compose', () => {
  assert.equal(canStartTopic('CUBE','help'),true);
  assert.equal(canStartTopic('CUBE','announcements'),false);
  assert.equal(canStartTopic('MENTOR','announcements'),true);
  assert.equal(canStartTopic('ADMIN','announcements'),true);
  assert.equal(canStartTopic('unrecognised','help'),false);
});
test('the complete design seed and a new topic without a quest survive reload', () => {
  const topics = [{...initialTopics[0], id:'new-local',questId:null,replies:[]},...initialTopics];
  assert.deepEqual(parseStored(JSON.stringify(topics),initialTopics),topics);
});

test('forum styles cannot target the portal outside the preview root', () => {
 const css = postcss.parse(readFileSync(new URL('../src/pages/forum/forum.css',import.meta.url),'utf8'));
 css.walkRules(rule => { if(rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return; for(const selector of rule.selectors) assert.ok(selector.startsWith('.cube-forum'), selector); });
});
