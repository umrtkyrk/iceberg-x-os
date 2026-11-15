import assert from 'node:assert/strict';
import test from 'node:test';
import { criterionKey, normalizeLevels } from '../src/services/rubric.service';

const five = (overrides: Record<number, string> = {}) =>
  [1, 2, 3, 4, 5].map(level => ({ level, description: overrides[level] ?? `Level ${level} text` }));

test('levels are trimmed and returned in order 1 to 5', () => {
  const shuffled = [...five({ 3: '  Meets expectations  ' })].reverse();
  assert.deepEqual(normalizeLevels(shuffled).map(l => l.level), [1, 2, 3, 4, 5]);
  assert.equal(normalizeLevels(shuffled)[2].description, 'Meets expectations');
});

test('all five levels are required, once each, with text', () => {
  assert.throws(() => normalizeLevels(five().slice(0, 4)), /all five/);
  assert.throws(() => normalizeLevels([...five().slice(0, 4), { level: 4, description: 'again' }]), /twice/);
  assert.throws(() => normalizeLevels(five({ 2: '   ' })), /level 2/);
  assert.throws(() => normalizeLevels([...five().slice(0, 4), { level: 6, description: 'x' }]), /1, 2, 3, 4 or 5/);
  assert.throws(() => normalizeLevels(five({ 5: 'x'.repeat(301) })), /longer/);
  assert.throws(() => normalizeLevels('nope'));
});

test('criterion keys use underscores', () => {
  assert.equal(criterionKey('Content & creative quality'), 'content_creative_quality');
  assert.equal(criterionKey('Müşteri İletişimi'), 'musteri_iletisimi');
});
