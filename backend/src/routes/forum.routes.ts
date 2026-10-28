import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middlewares/auth.middleware';
import { FORUM_ENABLED } from '../config/env';
import { badRequest, sendError } from '../utils/http';
import { forumPage, forumText } from '../services/forumPolicy';
import * as forum from '../services/forum.service';

const router = Router();
const buckets = new Map<string, { count: number; until: number }>();
const timer = setInterval(() => { for (const [id, bucket] of buckets) if (bucket.until <= Date.now()) buckets.delete(id); }, 60000);
timer.unref();
router.use('/forum', (_req, res, next) => FORUM_ENABLED ? next() : res.status(404).json({ error: 'Forum henüz etkin değil.' }), requireAuth);
router.use('/forum', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.method === 'GET') return next();
  const id = req.user!.id, now = Date.now(), old = buckets.get(id);
  const bucket = old && old.until > now ? old : { count: 0, until: now + 60000 };
  bucket.count++; buckets.set(id, bucket);
  if (bucket.count > 20) { res.setHeader('Retry-After', Math.ceil((bucket.until - now) / 1000)); return res.status(429).json({ error: 'Çok hızlı işlem yapıyorsun. Biraz bekle.' }); }
  next();
});
type Handler = (req: AuthenticatedRequest) => Promise<unknown>;
const handle = (fn: Handler, status = 200) => async (req: AuthenticatedRequest, res: Response) => {
  try { return res.status(status).json(await fn(req)); } catch (error) { return sendError(res, error); }
};
function body(req: AuthenticatedRequest): Record<string, unknown> {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw badRequest('Geçersiz istek.');
  return req.body;
}
router.get('/forum/categories', handle(() => forum.forumCategories()));
router.get('/forum/topics', handle(req => {
  const category = req.query.category === undefined ? undefined : forumText(req.query.category, 'Kategori', 1, 80);
  const query = req.query.q === undefined ? undefined : forumText(req.query.q, 'Arama', 1, 100);
  const view = req.query.view === undefined ? undefined : forumText(req.query.view, 'Görünüm', 1, 20);
  if (view && !['all', 'saved', 'following', 'unanswered', 'solved'].includes(view)) throw badRequest('Geçersiz görünüm.');
  const sort = req.query.sort === undefined ? undefined : forumText(req.query.sort, 'Sıralama', 1, 20);
  if (sort && !['newest', 'active'].includes(sort)) throw badRequest('Geçersiz sıralama.');
  return forum.listForumTopics(req.user!, { category, query, view, sort, page: forumPage(req.query.page) });
}));
router.get('/forum/topics/:id', handle(req => forum.readForumTopic(req.user!, req.params.id, forumPage(req.query.page))));
router.post('/forum/topics', handle(req => forum.createForumTopic(req.user!, body(req)), 201));
router.patch('/forum/topics/:id', handle(req => forum.changeForumTopic(req.user!, req.params.id, body(req))));
router.delete('/forum/topics/:id', handle(req => forum.changeForumTopic(req.user!, req.params.id, {}, true)));
router.patch('/forum/topics/:id/moderation', handle(req => forum.moderateForumTopic(req.user!, req.params.id, body(req))));
router.put('/forum/topics/:id/state', handle(req => forum.setForumState(req.user!, req.params.id, body(req))));
router.put('/forum/topics/:id/answer', handle(req => forum.acceptForumAnswer(req.user!, req.params.id, body(req))));
router.post('/forum/topics/:id/replies', handle(req => forum.createForumReply(req.user!, req.params.id, body(req)), 201));
router.patch('/forum/topics/:id/replies/:replyId', handle(req => forum.changeForumReply(req.user!, req.params.id, req.params.replyId, body(req))));
router.delete('/forum/topics/:id/replies/:replyId', handle(req => forum.changeForumReply(req.user!, req.params.id, req.params.replyId, {}, true)));
router.post('/forum/topics/:id/reports', handle(req => forum.reportForumPost(req.user!, req.params.id, body(req)), 201));
router.get('/forum/reports', handle(req => forum.listForumReports(req.user!, forumPage(req.query.page))));
router.patch('/forum/reports/:id', handle(req => forum.resolveForumReport(req.user!, req.params.id)));
export default router;
