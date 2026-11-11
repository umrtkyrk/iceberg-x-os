import assert from 'node:assert/strict';
import test from 'node:test';
import {
  QUESTION_MIN_LENGTH,
  RECOVERY_NOTE_MIN_LENGTH,
  canSubmitRecovery,
  formatQuestionsForSpeaker,
  parseAttendanceStatus,
  parseQuestionGroups,
  parseRecoveryNote,
  reminderDue,
  scoreWebinar,
  summarizeEngagement,
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
    { id: 'a', body: 'Late one', is_late: true },
    { id: 'b', body: 'First\n  on time', is_late: false },
  ]);
  assert.equal(text, 'Questions from the Cubes: Career Talk\n\n1. First on time\n2. Late one');
});

test('speaker export puts upvoted questions first and groups by theme', () => {
  const qs = [
    { id: 'a', body: 'A', is_late: false, votes: 0 },
    { id: 'b', body: 'B', is_late: false, votes: 3 },
    { id: 'c', body: 'C', is_late: true, votes: 9 },
    { id: 'd', body: 'D', is_late: false, votes: 1 },
  ];
  assert.equal(formatQuestionsForSpeaker('T', qs), 'Questions from the Cubes: T\n\n1. B\n2. D\n3. A\n4. C');
  const grouped = formatQuestionsForSpeaker('T', qs, [{ title: 'Leadership', question_ids: ['a', 'b'] }]);
  assert.equal(
    grouped,
    'Questions from the Cubes: T\n\n## Leadership\n1. B\n2. A\n\n## Other questions\n3. D\n4. C'
  );
});

test('AI groups are validated: unknown refs dropped, duplicates kept once, leftovers grouped', () => {
  const refs = new Map([['q1', 'id1'], ['q2', 'id2'], ['q3', 'id3']]);
  const groups = parseQuestionGroups(
    JSON.stringify({ groups: [
      { title: '  First   job ', questions: ['q1', 'Q2', 'q9'] },
      { title: 'Again', questions: ['q2'] },
      { title: '', questions: ['q3'] },
    ] }),
    refs
  );
  assert.deepEqual(groups, [
    { title: 'First job', question_ids: ['id1', 'id2'] },
    { title: 'Other questions', question_ids: ['id3'] },
  ]);
  assert.deepEqual(parseQuestionGroups('not json', refs), []);
  assert.deepEqual(parseQuestionGroups('{"groups":[]}', refs), []);
});

test('webinar score is half questions and half attendance', () => {
  const onTime = [{ is_late: false, is_strong: false }];
  assert.equal(scoreWebinar(onTime, null), null);
  assert.equal(scoreWebinar(onTime, { status: 'Present' })!.score, 85);
  assert.equal(scoreWebinar([{ is_late: true, is_strong: true }], { status: 'Present' })!.score, 100);
  assert.equal(scoreWebinar([{ is_late: true, is_strong: false }], { status: 'Late' })!.score, 55);
  assert.equal(scoreWebinar([], { status: 'Absent' })!.score, 0);
  assert.equal(scoreWebinar(onTime, { status: 'Absent', recovery_status: 'Approved' })!.score, 60);
  assert.equal(scoreWebinar(onTime, { status: 'Absent', recovery_status: 'Pending' })!.score, 35);
  const excused = scoreWebinar(onTime, { status: 'Excused' })!;
  assert.equal(excused.attendance_points, null);
  assert.equal(excused.score, 70);
});

test('engagement summary leaves excused webinars out of the attendance rate', () => {
  const s = (q: any[], status: any, recovery_status: any = null) => scoreWebinar(q, { status, recovery_status })!;
  const summary = summarizeEngagement([
    s([{ is_late: false, is_strong: true }], 'Present'),
    s([], 'Absent', 'Approved'),
    s([{ is_late: false, is_strong: false }], 'Excused'),
  ]);
  assert.equal(summary.scored, 3);
  assert.equal(summary.average, Math.round((100 + 25 + 70) / 3));
  assert.equal(summary.attendance_rate, 50);
  assert.equal(summary.missed_questions, 1);
  assert.equal(summary.strong_questions, 1);
  assert.equal(summary.recovered, 1);
  assert.equal(summary.excused, 1);
  assert.equal(summarizeEngagement([]).average, null);
});

test('recovery needs an absence, a recording and an open window', () => {
  const webinar = {
    status: 'Completed',
    date: new Date('2026-11-01T18:00:00Z'),
    completed_at: new Date('2026-11-02T10:00:00Z'),
    recording_url: 'https://example.com/rec',
  };
  const absent = { status: 'Absent', recovery_status: null };
  assert.equal(canSubmitRecovery(webinar, absent, new Date('2026-11-10T00:00:00Z')), true);
  assert.equal(canSubmitRecovery(webinar, absent, new Date('2026-11-17T00:00:00Z')), false);
  assert.equal(canSubmitRecovery({ ...webinar, recording_url: null }, absent, new Date('2026-11-10T00:00:00Z')), false);
  assert.equal(canSubmitRecovery(webinar, { status: 'Present' }, new Date('2026-11-10T00:00:00Z')), false);
  assert.equal(canSubmitRecovery(webinar, { status: 'Absent', recovery_status: 'Approved' }, new Date('2026-11-10T00:00:00Z')), false);
  assert.equal(canSubmitRecovery(webinar, { status: 'Absent', recovery_status: 'Rejected' }, new Date('2026-11-10T00:00:00Z')), true);
  assert.throws(() => parseRecoveryNote('too short'), /at least/);
  assert.equal(parseRecoveryNote(' ' + 'x'.repeat(RECOVERY_NOTE_MIN_LENGTH) + ' ').length, RECOVERY_NOTE_MIN_LENGTH);
  assert.throws(() => parseAttendanceStatus('Maybe'), /Attendance must be/);
});

test('reminders fire once in their window and not right after publishing', () => {
  const w = {
    status: 'Published',
    date: new Date('2026-12-03T18:00:00Z'),
    questions_close_at: new Date('2026-12-02T18:00:00Z'),
    published_at: new Date('2026-11-20T10:00:00Z'),
  };
  assert.deepEqual(reminderDue(w, new Date('2026-12-01T10:00:00Z')), { deadline: false, start: false });
  assert.deepEqual(reminderDue(w, new Date('2026-12-02T10:00:00Z')), { deadline: true, start: false });
  assert.deepEqual(reminderDue({ ...w, deadline_reminder_sent_at: new Date() }, new Date('2026-12-02T10:00:00Z')), { deadline: false, start: false });
  assert.deepEqual(reminderDue({ ...w, published_at: new Date('2026-12-02T09:00:00Z') }, new Date('2026-12-02T10:00:00Z')), { deadline: false, start: false });
  assert.deepEqual(reminderDue(w, new Date('2026-12-03T17:30:00Z')), { deadline: false, start: true });
  assert.deepEqual(reminderDue({ ...w, status: 'Draft' }, new Date('2026-12-03T17:30:00Z')), { deadline: false, start: false });
});
