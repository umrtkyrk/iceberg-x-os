import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { AuthenticatedRequest, requireAuth } from '../middlewares/auth.middleware';
import { FORUM_ENABLED } from '../config/env';
import { badRequest, sendError } from '../utils/http';
import { forumPage, forumText } from '../services/forumPolicy';
import { forumViewer, saveForumProfile, assertForumPosting } from '../services/forumIdentity.service';
import { forumContext } from '../services/forumContext.service';
import { forumMentionPeople } from '../services/forumNotifications.service';
import { manageForumCategory } from '../services/forumCategory.service';
import * as forum from '../services/forum.service';
import { StorageService } from '../services/storage.service';

const router = Router();
const buckets = new Map<string, { count: number; until: number }>();
const timer = setInterval(() => { for (const [id, bucket] of buckets) if (bucket.until <= Date.now()) buckets.delete(id); }, 60000);
timer.unref();
router.use('/forum', (_req, res, next) => FORUM_ENABLED ? next() : res.status(404).json({ error: 'The forum is not enabled yet.' }), requireAuth);
router.use('/forum', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.method === 'GET') return next();
  const id = req.user!.id, now = Date.now(), old = buckets.get(id);
  const bucket = old && old.until > now ? old : { count: 0, until: now + 60000 };
  bucket.count++; buckets.set(id, bucket);
  if (bucket.count > 20) { res.setHeader('Retry-After', Math.ceil((bucket.until - now) / 1000)); return res.status(429).json({ error: 'You are posting too fast. Please wait a moment.' }); }
  next();
});
type Handler = (req: AuthenticatedRequest) => Promise<unknown>;
const handle = (fn: Handler, status = 200) => async (req: AuthenticatedRequest, res: Response) => {
  try { return res.status(status).json(await fn(req)); } catch (error) { return sendError(res, error); }
};
function body(req: AuthenticatedRequest): Record<string, unknown> {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw badRequest('Invalid request.');
  return req.body;
}
const posting = (fn: Handler): Handler => async req => { body(req); await assertForumPosting(req.user!); return fn(req); };
const FORUM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const FORUM_IMAGES_PER_HOUR = 30;
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: FORUM_IMAGE_MAX_BYTES, files: 1 } });
const imageBuckets = new Map<string, { count: number; until: number }>();
const imageTimer = setInterval(() => { for (const [id, bucket] of imageBuckets) if (bucket.until <= Date.now()) imageBuckets.delete(id); }, 600000);
imageTimer.unref();

/** Detects the image type from the file's first bytes; the client's MIME type and name are not trusted. */
export function forumImageType(buffer: Buffer): 'png' | 'jpg' | 'webp' | 'gif' | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return 'gif';
  return null;
}

router.post('/forum/images', (req: AuthenticatedRequest, res: Response) => {
  imageUpload.single('image')(req, res, async error => {
    try {
      if (error instanceof multer.MulterError) throw badRequest(error.code === 'LIMIT_FILE_SIZE' ? 'Images can be up to 5 MB.' : 'Upload one image at a time.');
      if (error) throw error;
      await assertForumPosting(req.user!);
      const now = Date.now(), old = imageBuckets.get(req.user!.id);
      const bucket = old && old.until > now ? old : { count: 0, until: now + 3600000 };
      if (bucket.count >= FORUM_IMAGES_PER_HOUR) { res.setHeader('Retry-After', Math.ceil((bucket.until - now) / 1000)); return res.status(429).json({ error: 'You have uploaded a lot of images. Please try again later.' }); }
      const file = req.file;
      if (!file) throw badRequest('Choose an image to upload.');
      const type = forumImageType(file.buffer);
      if (!type) throw badRequest('Only PNG, JPEG, WEBP and GIF images can be uploaded.');
      bucket.count++; imageBuckets.set(req.user!.id, bucket);
      const { relativeUrl } = await StorageService.saveForumImage(file.buffer, type);
      return res.status(201).json({ url: relativeUrl });
    } catch (caught) {
      return sendError(res, caught);
    }
  });
});
router.get('/forum/me/profile', handle(req => forumViewer(req.user!)));
router.put('/forum/me/profile', handle(req => saveForumProfile(req.user!, body(req))));
router.get('/forum/context', handle(req => forumContext(req.user!)));
router.get('/forum/mentions', handle(req => forumMentionPeople(req.query.q === undefined ? '' : forumText(req.query.q, 'Search', 1, 80))));
router.post('/forum/categories', handle(req => manageForumCategory(req.user!, undefined, body(req)), 201));
router.patch('/forum/categories/:id', handle(req => manageForumCategory(req.user!, req.params.id, body(req))));
router.delete('/forum/categories/:id', handle(req => manageForumCategory(req.user!, req.params.id, {}, true)));
router.get('/forum/stats', handle(() => forum.forumStats()));
router.get('/forum/dashboard', handle(req => forum.forumDashboard(req.user!)));
router.get('/forum/categories', handle(() => forum.forumCategories()));
router.get('/forum/topics', handle(req => {
  const category = req.query.category === undefined ? undefined : forumText(req.query.category, 'Category', 1, 80);
  const query = req.query.q === undefined ? undefined : forumText(req.query.q, 'Search', 1, 100);
  const view = req.query.view === undefined ? undefined : forumText(req.query.view, 'View', 1, 20);
  if (view && !['all', 'saved', 'following', 'unanswered', 'solved'].includes(view)) throw badRequest('Invalid view.');
  const sort = req.query.sort === undefined ? undefined : forumText(req.query.sort, 'Sort', 1, 20);
  if (sort && !['newest', 'active'].includes(sort)) throw badRequest('Invalid sort order.');
  const quest = req.query.quest === undefined ? undefined : forumText(req.query.quest, 'Quest', 1, 100);
  const mission = req.query.mission === undefined ? undefined : forumText(req.query.mission, 'Mission', 1, 100);
  return forum.listForumTopics(req.user!, { category, query, view, sort, quest, mission, page: forumPage(req.query.page) });
}));
router.get('/forum/topics/:id', handle(req => forum.readForumTopic(req.user!, req.params.id, forumPage(req.query.page), req.query.reply === undefined ? undefined : forumText(req.query.reply, 'Reply', 1, 100))));
router.post('/forum/topics', handle(posting(req => forum.createForumTopic(req.user!, body(req))), 201));
router.patch('/forum/topics/:id', handle(posting(req => forum.changeForumTopic(req.user!, req.params.id, body(req)))));
router.delete('/forum/topics/:id', handle(req => forum.changeForumTopic(req.user!, req.params.id, {}, true)));
router.patch('/forum/topics/:id/moderation', handle(req => forum.moderateForumTopic(req.user!, req.params.id, body(req))));
router.put('/forum/topics/:id/state', handle(req => forum.setForumState(req.user!, req.params.id, body(req))));
router.put('/forum/topics/:id/like', handle(posting(req => forum.likeForumPost(req.user!, req.params.id, undefined, body(req)))));
router.put('/forum/topics/:id/replies/:replyId/like', handle(posting(req => forum.likeForumPost(req.user!, req.params.id, req.params.replyId, body(req)))));
router.put('/forum/topics/:id/answer', handle(posting(req => forum.acceptForumAnswer(req.user!, req.params.id, body(req)))));
router.post('/forum/topics/:id/replies', handle(posting(req => forum.createForumReply(req.user!, req.params.id, body(req))), 201));
router.patch('/forum/topics/:id/replies/:replyId', handle(posting(req => forum.changeForumReply(req.user!, req.params.id, req.params.replyId, body(req)))));
router.delete('/forum/topics/:id/replies/:replyId', handle(req => forum.changeForumReply(req.user!, req.params.id, req.params.replyId, {}, true)));
router.post('/forum/topics/:id/reports', handle(req => forum.reportForumPost(req.user!, req.params.id, body(req)), 201));
router.get('/forum/reports', handle(req => forum.listForumReports(req.user!, forumPage(req.query.page))));
router.patch('/forum/reports/:id', handle(req => forum.resolveForumReport(req.user!, req.params.id)));
export default router;
