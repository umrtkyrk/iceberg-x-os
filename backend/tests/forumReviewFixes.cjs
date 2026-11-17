module.exports = async ({ db, forum, chat, cube, other, staff }) => {
  const assert = require('node:assert/strict');
  const { randomUUID } = require('node:crypto');
  const post = await forum.createForumTopic(cube, { category_id: 'help', title: 'Restricted report regression', body: 'PrivateReportBodySentinel', visibility: 'PRIVATE', audience_user_ids: [other.id] });
  const report = await forum.reportForumPost(other, post.id, { reason: 'Review this restricted post.' });
  await assert.rejects(forum.readForumTopic(staff, post.id, 1), e => e.status === 404);
  assert.equal((await forum.listForumReports(staff, 1)).reports.some(row => row.id === report.id), false);
  await assert.rejects(forum.resolveForumReport(staff, report.id), e => e.status === 404);
  const dashboardBefore = await forum.forumDashboard(staff);
  await forum.changeForumTopic(cube, post.id, { title: post.title, body: post.body, visibility: 'PRIVATE', audience_user_ids: [other.id, staff.id] });
  assert.ok((await forum.listForumReports(staff, 1)).reports.some(row => row.id === report.id));
  assert.equal((await forum.forumDashboard(staff)).open_reports, dashboardBefore.open_reports + 1);
  await forum.resolveForumReport(staff, report.id);
  assert.ok((await db.forumReport.findUnique({ where: { id: report.id } })).resolved_at);
  const server = require('../dist/app').default.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await forum.changeForumTopic(cube, post.id, { title: post.title, body: post.body, visibility: 'PRIVATE', audience_user_ids: [other.id] });
    const hiddenReport = await forum.reportForumPost(other, post.id, { reason: 'A new restricted report.' });
    const jwt = require('jsonwebtoken');
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/forum/reports', { headers: { Authorization: 'Bearer ' + jwt.sign(staff, process.env.JWT_SECRET) } });
    assert.equal(response.status, 200); assert.doesNotMatch(await response.text(), /PrivateReportBodySentinel/);
    const deniedResolve = await fetch('http://127.0.0.1:' + server.address().port + '/api/forum/reports/' + hiddenReport.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + jwt.sign(staff, process.env.JWT_SECRET), 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(deniedResolve.status, 404);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  const group = await chat.createChatRoom(cube, { name: 'Public GitHub regression', member_ids: [] });
  const repo = 'review-org/private-' + randomUUID();
  await chat.setChatRepo(cube, group.id, { repo });
  const originalFetch = global.fetch, oldToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'synthetic-test-only-token';
  const calls = [];
  global.fetch = async (url, options) => { calls.push(options.headers); return { ok: false, status: 404 }; };
  try {
    const activity = await chat.chatGithub(cube, group.id);
    assert.ok(activity.error); assert.deepEqual(activity.commits, []); assert.deepEqual(activity.pulls, []);
    assert.ok(calls.length > 0); assert.ok(calls.every(headers => !headers.Authorization));
    const publicRepo = 'review-org/public-' + randomUUID();
    await chat.setChatRepo(cube, group.id, { repo: publicRepo });
    global.fetch = async (url, options) => {
      assert.equal(options.headers.Authorization, undefined);
      return { ok: true, json: async () => String(url).includes('/commits?') ? [{ sha: 'abcdef1234567', html_url: 'https://github.com/' + publicRepo, commit: { message: 'Public activity', author: null }, author: null }] : [] };
    };
    assert.equal((await chat.chatGithub(cube, group.id)).commits[0].message, 'Public activity');
  } finally { global.fetch = originalFetch; if (oldToken === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = oldToken; }
  console.log('PASS: report list/count/resolve privacy and public-only GitHub activity without server-token forwarding.');
};
