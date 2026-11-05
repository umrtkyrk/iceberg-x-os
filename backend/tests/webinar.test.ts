import assert from 'node:assert/strict';
import test from 'node:test';
import {
  QUESTION_MIN_LENGTH,
  formatQuestionsForSpeaker,
  parseCareer,
  parseExpertise,
  parseHttpUrl,
  parseQuestionBody,
  parseSchedule,
  questionWindow,
} from '../src/services/webinar';

const start = new Date('2026-12-01T18:00:00Z');
const close = new Date('2026-11-30T18:00:00Z');
const published = { status: 'Published', date: start, questions_close_at: close };

test('question window follows the deadline and the start time', () => {
  assert.equal(questionWindow(published, new Date('2026-11-30T10:00:00Z')), 'open');
  assert.equal(questionWindow(published, new Date('2026-11-30T18:00:00Z')), 'late');
  assert.equal(questionWindow(published, new Date('2026-12-01T17:59:00Z')), 'late');
  assert.equal(questionWindow(published, new Date('2026-12-01T18:00:00Z')), 'closed');
});

test('drafts are not open and finished webinars are closed', () => {
  const early = new Date('2026-11-01T00:00:00Z');
  assert.equal(questionWindow({ ...published, status: 'Draft' }, early), 'not_open');
  assert.equal(questionWindow({ ...published, status: 'Completed' }, early), 'closed');
  assert.equal(questionWindow({ ...published, status: 'Cancelled' }, early), 'closed');
});

test('question body must have real content', () => {
  assert.throws(() => parseQuestionBody('Nasıl başladınız?'), /at least/);
  assert.throws(() => parseQuestionBody('   '), /at least/);
  assert.throws(() => parseQuestionBody('x'.repeat(1001)), /at most/);
  const ok = '  ' + 'a'.repeat(QUESTION_MIN_LENGTH) + '  ';
  assert.equal(parseQuestionBody(ok), 'a'.repeat(QUESTION_MIN_LENGTH));
});

test('links accept only http(s) and add a missing scheme', () => {
  assert.equal(parseHttpUrl('linkedin.com/in/someone', 'LinkedIn'), 'https://linkedin.com/in/someone');
  assert.equal(parseHttpUrl('', 'LinkedIn'), null);
  assert.equal(parseHttpUrl(null, 'LinkedIn'), null);
  assert.throws(() => parseHttpUrl('javascript:alert(1)', 'LinkedIn'), /http\(s\)/);
  assert.throws(() => parseHttpUrl('ftp://example.com', 'LinkedIn'), /http\(s\)/);
});

test('deadline defaults to 24 hours before the start and cannot follow it', () => {
  const s = parseSchedule('2026-12-01T18:00:00Z', null);
  assert.equal(s.questions_close_at.toISOString(), '2026-11-30T18:00:00.000Z');
  assert.throws(() => parseSchedule('2026-12-01T18:00:00Z', '2026-12-02T00:00:00Z'), /before/);
  assert.throws(() => parseSchedule('not a date', null), /valid webinar date/);
});

test('career rows are trimmed and empty rows dropped', () => {
  const career = parseCareer([
    { title: ' CTO ', company: 'Acme', period: '2020 - now' },
    { title: '', company: '' },
    'garbage',
  ]);
  assert.deepEqual(career, [{ title: 'CTO', company: 'Acme', period: '2020 - now', description: '' }]);
});

test('expertise tags are de-duplicated case-insensitively', () => {
  assert.deepEqual(parseExpertise('AI, ai , Product,,Leadership'), ['AI', 'Product', 'Leadership']);
});

test('speaker export is anonymous and lists late questions last', () => {
  const text = formatQuestionsForSpeaker('Career Talk', [
    { body: 'Late one', is_late: true },
    { body: 'First\n  on time', is_late: false },
  ]);
  assert.equal(text, 'Questions from the Cubes: Career Talk\n\n1. First on time\n2. Late one');
});
