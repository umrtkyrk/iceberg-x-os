import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import vm from 'node:vm';
// Exercise the actual component's handlers and rendering with deterministic hooks.
function editorHarness(initial, options = {}) {
  let stored = initial, states = [], refs = [], si = 0, ri = 0, nodes = [];
  const field = { value: '', selectionStart: 0, selectionEnd: 0, focus() {}, setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; } };
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: initial => { const i = si++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef: initial => refs[ri++] ||= { current: initial }, useEffect() {}, };
  const cache = new Map();
  const load = relative => {
    if (cache.has(relative)) return cache.get(relative);
    const code = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    const mod = { exports: {} };
    vm.runInNewContext(code, { module: mod, exports: mod.exports, Map, Set, setTimeout: callback => callback(), require: id => {
      if (id === 'react') return react;
      if (id === 'react-markdown') return 'Markdown';
      if (id === 'lucide-react') return new Proxy({}, { get: (_, key) => key });
      if (id === './MentionTextarea') return { MentionTextarea: 'MentionTextarea' };
      if (id.endsWith('/mentions')) return load('../src/utils/mentions.tsx');
      if (id.endsWith('/forumImages')) return load('../src/utils/forumImages.tsx');
      if (id === 'react-router-dom') return { Link: 'a' };
      if (id.endsWith('/assets') || id === './assets') return { getAssetUrl: value => value };
      if (id === './api') return { api: {} };
      throw new Error('Unexpected editor dependency ' + id);
    } });
    cache.set(relative, mod.exports); return mod.exports;
  };
  const { MarkdownEditor } = load('../src/components/MarkdownEditor.tsx');
  const flatten = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...node.children.flatMap(flatten)];
  const render = () => { si = ri = 0;
    nodes = flatten(MarkdownEditor({ value: stored, onChange: next => { stored = next; }, mentions: true, emojiPicker: true, onUploadImage: async () => '', ...options }));
    const input = nodes.find(n => n.type === 'MentionTextarea');
    if (input) { field.value = input.props.value; input.props.ref.current = field; }
  };
  render();
  return { get value() { return stored; }, field,
    click(label) { const node = nodes.find(n => n.props['aria-label'] === label || n.type === 'button' && n.children.some(c => c?.type === 'span' && c.children.includes(label))); assert.ok(node, label); node.props.onClick(); render(); },
    has(type) { return nodes.some(n => n.type === type); }, hasAlert() { return nodes.some(n => n.props.role === 'alert'); },
  };
}
const model = ts.transpileModule(readFileSync(new URL('../src/pages/forum/forumModel.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { forumLocation, forumPageParams, forumListParams, forumSearchParams, forumReadStatus } = await import('data:text/javascript;base64,' + Buffer.from(model).toString('base64'));
const mentionsSource = 'const React = { createElement: () => null }; const Link = "a";\n' +
  readFileSync(new URL('../src/utils/mentions.tsx', import.meta.url), 'utf8').replace(/^import\s+.*$/gm, '');
const mentionsJs = ts.transpileModule(mentionsSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
const { encodeMentions, encodeMentionsWithinLimit, mentionOverhead, mentionsToText } = await import('data:text/javascript;base64,' + Buffer.from(mentionsJs).toString('base64'));

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

test('encodeMentions skips inline code and fenced/indented code blocks and clamps maxLength cleanly', () => {
  const known = new Map([['Ali Veli', 'cube-001'], ['Ali Veli Kaya', 'cube-002']]);
  const raw = 'Hi @Ali Veli Kaya, check `@Ali Veli` and:\n```ts\n// @Ali Veli\n```\n    @Ali Veli\nDone @Ali Veli!';
  const encoded = encodeMentions(raw, known);
  assert.equal(encoded, 'Hi [@Ali Veli Kaya](@cube-002), check `@Ali Veli` and:\n```ts\n// @Ali Veli\n```\n    @Ali Veli\nDone [@Ali Veli](@cube-001)!');
  const clamped = encodeMentions('Hello @Ali Veli world', known, 26);
  assert.ok(clamped.length <= 26);
  assert.doesNotMatch(clamped, /\[@/);
  const clampedSafe = encodeMentions('Hello @Ali Veli world suffix that exceeds limit', known, 35);
  assert.ok(clampedSafe.length <= 35);
  assert.ok(clampedSafe.startsWith('Hello [@Ali Veli](@cube-001)'));
  assert.equal(mentionsToText(encoded), raw);
});

test('mention selection near the limit rejects the edit without losing the existing suffix', () => {
  const known = new Map([['Ali Veli', 'cube-001']]);
  const original = 'A'.repeat(4975) + ' @Al TAIL-KEEP';
  const proposed = 'A'.repeat(4975) + ' @Ali Veli TAIL-KEEP';
  assert.ok(proposed.length < 5000);
  const encoded = encodeMentionsWithinLimit(proposed, known, 5000);
  assert.equal(encoded, null);
  // The editor commits only accepted edits, keeping the whole previous message on rejection.
  assert.equal(encoded ?? original, original);
  assert.ok((encoded ?? original).endsWith('TAIL-KEEP'));
});

test('accepted edits round-trip exactly at the stored limit for Cube and staff mentions', () => {
  for (const handle of ['cube-001', 'user-12345678-1234-1234-1234-123456789abc']) {
    const known = new Map([['Ali Veli', handle]]);
    const prose = 'Hello @Ali Veli TAIL-KEEP';
    const exactLength = encodeMentions(prose, known).length;
    const accepted = encodeMentionsWithinLimit(prose, known, exactLength);
    assert.equal(mentionsToText(accepted), prose);
    assert.equal(encodeMentionsWithinLimit(prose, known, exactLength - 1), null);
  }
});

test('replacing mentions releases their old budget and code remains literal', () => {
  const known = new Map([['Ali Veli', 'cube-001']]);
  const plainReplacement = 'x'.repeat(5000);
  assert.equal(encodeMentionsWithinLimit(plainReplacement, known, 5000), plainReplacement);
  assert.equal(encodeMentionsWithinLimit(plainReplacement + 'x', known, 5000), null);
  const code = '`@Ali Veli`';
  assert.equal(encodeMentionsWithinLimit(code, known, code.length), code);
  assert.equal(mentionsToText(encodeMentionsWithinLimit('Hello @Ali Veli', known)), 'Hello @Ali Veli');
});

test('mentionOverhead is the stored characters mention links add beyond the visible text', () => {
  assert.equal(mentionOverhead('plain text'), 0);
  assert.equal(mentionOverhead(''), 0);
  const stored = 'Hi [@Ali Veli](@cube-001)!';
  assert.equal(mentionsToText(stored), 'Hi @Ali Veli!');
  // The visible limit (stored limit minus overhead) keeps the stored body within the server limit.
  assert.equal(mentionsToText(stored).length + mentionOverhead(stored), stored.length);
});

test('forum CSS cannot style portal Markdown or controls outside the forum', () => {
  const css = postcss.parse(readFileSync(new URL('../src/pages/forum/talks.css', import.meta.url), 'utf8'));
  css.walkRules(rule => { for (const selector of rule.selectors) assert.ok(selector.startsWith('.cube-forum') || selector.startsWith(':where(.cube-forum) ' ), selector); });
});

const imagesSource = 'const api = {}; const getAssetUrl = value => "https://cdn.example" + value;\n' +
  readFileSync(new URL('../src/utils/forumImages.tsx', import.meta.url), 'utf8').replace(/^import\s+.*$/gm, '');
const imagesJs = ts.transpileModule(imagesSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
const { splitImages, joinImages, firstForumImage } = await import('data:text/javascript;base64,' + Buffer.from('const React = { createElement: () => null };\n' + imagesJs).toString('base64'));

test('attached images stay out of the typed text and round-trip exactly', () => {
  const a = '![shot](/uploads/forum/11111111-1111-1111-1111-111111111111.png)';
  const b = '![two](/uploads/forum/22222222-2222-2222-2222-222222222222.jpg)';
  for (const text of ['', 'Hello', 'Hello\n', 'Hello\n\n', '\n', 'Line one\n\nLine two', 'Thanks [@Zelal Erpay](@cube-015) ']) {
    for (const images of [[], [a], [a, b]]) assert.deepEqual(splitImages(joinImages(text, images)), { text, images });
  }
  // Posts written before attachments existed: an image on the line after the text.
  assert.deepEqual(splitImages(`Look\n${a}\n`), { text: 'Look', images: [a] });
  // An image in the middle of the text is part of the text.
  assert.deepEqual(splitImages(`Before ${a} after`).images, []);
  assert.equal(firstForumImage(`x ![bad](https://tracker.example/p.png) ${b}`).src, 'https://cdn.example/uploads/forum/22222222-2222-2222-2222-222222222222.jpg');
  assert.equal(firstForumImage('no images'), null);
});

test('image-only drafts render the real Markdown preview', () => {
  const editor = editorHarness('![shot](/uploads/forum/11111111-1111-1111-1111-111111111111.png)');
  editor.click('Preview'); assert.equal(editor.has('Markdown'), true);
});
test('emoji picker replaces selection while preserving mentions and attachments', () => {
  const image = '![shot](/uploads/forum/11111111-1111-1111-1111-111111111111.png)';
  const editor = editorHarness(joinImages('Hi [@Ada Demo](@cube-951) world', [image]));
  editor.field.selectionStart = editor.field.value.indexOf('world'); editor.field.selectionEnd = editor.field.value.length;
  editor.click('Add emoji'); editor.click('Insert Rocket emoji');
  assert.equal(editor.value, joinImages('Hi [@Ada Demo](@cube-951) 🚀', [image]));
});
test('an over-budget emoji preserves text, mentions and attachments', () => {
  const body = joinImages('Hi [@Ada Demo](@cube-951)', ['![shot](/uploads/forum/11111111-1111-1111-1111-111111111111.png)']);
  const editor = editorHarness(body, { maxLength: body.length + 1 });
  editor.field.selectionStart = editor.field.selectionEnd = editor.field.value.length;
  editor.click('Add emoji'); editor.click('Insert Rocket emoji');
  assert.equal(editor.value, body); assert.equal(editor.hasAlert(), true);
});

// Render actual Markdown through the production anchor component.
const { createRequire } = await import('node:module');
const realRequire = createRequire(import.meta.url);
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { default: RealMarkdown } = await import('react-markdown');
const linkModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/utils/mentions.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText, { module: linkModule, exports: linkModule.exports, require: realRequire });
const renderLink = body => renderToStaticMarkup(createElement(RealMarkdown, { components: { a: linkModule.exports.MentionAwareLink } }, body));
test('posted and previewed web links resolve outside portal routes', () => {
  for (const url of ['github.com/umrtkyrk', 'www.example.com/docs', 'https://example.com/docs', '//example.com/docs']) {
    const html = renderLink('[Resource](' + url + ')');
    const expected = url.startsWith('http') || url.startsWith('//') ? url : 'https://' + url;
    assert.ok(html.includes('href="' + expected + '"'), html);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.equal(new URL(expected, 'https://portal.example/forum').hostname === 'portal.example', false);
  }
});
test('portal links and mentions remain intact; unsafe destinations stay inactive', () => {
  assert.match(renderLink('[Topic](/forum?topic=abc)'), /href="\/forum\?topic=abc"/);
  assert.doesNotMatch(renderLink('[Topic](/forum?topic=abc)'), /target=/);
  assert.match(renderLink('[@Ada](@cube-018)'), /class="mention-tag"/);
  assert.doesNotMatch(renderLink('[Unsafe](javascript:alert)'), /href=/);
});
