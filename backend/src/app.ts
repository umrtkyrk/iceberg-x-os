import express from 'express';
import cors from 'cors';
import path from 'path';
import { APP_URL, IS_PROD, STORAGE_PATH } from './config/env';
import router from './routes';

const app = express();

// Behind Railway / any reverse proxy, without this every request looks like it
// came from the proxy: `req.ip` is the proxy's address, so the login rate limit
// would count all users into a single bucket and lock everyone out together,
// and `req.protocol` would report http on an https deployment.
if (IS_PROD) {
  app.set('trust proxy', 1);
}

// Explicit allow-list. Development origins stay open because the Vite dev
// server runs on a different port; production accepts only APP_URL.
const allowedOrigins = IS_PROD
  ? [APP_URL]
  : [APP_URL, 'http://localhost:5001', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Requests with no Origin header (same-origin, curl, health checks)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Return false rather than throwing so Express answers 403-style instead of 500
    return callback(null, false);
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Path to frontend build output
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

// Serve static assets in production/Docker
app.use(express.static(frontendDistPath));

// Serve uploaded avatars statically
// Note: Confidential documents (NDAs, Cube docs) are strictly NOT served statically;
// they are guarded by authentication and access control via /api/documents/:id/file.
const avatarsStoragePath = path.join(STORAGE_PATH, 'avatars');
const legacyAvatarsPath = path.resolve(__dirname, '../uploads/avatars');
app.use('/uploads/avatars', express.static(avatarsStoragePath));
app.use('/uploads/avatars', express.static(legacyAvatarsPath));
// Forum post images: random names, contents verified as PNG/JPEG/WEBP/GIF on upload.
// nosniff stops a browser from treating one as anything other than an image.
app.use('/uploads/forum', express.static(path.join(STORAGE_PATH, 'forum'), {
  setHeaders: res => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox"); },
}));

// Mount all API routes
app.use('/api', router);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// SPA routing fallback for React router
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// 404 handler for API or missing assets
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware. Logs the full error but never returns internal
// details (Prisma messages expose table and column names) to the client.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[app] Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

export default app;
