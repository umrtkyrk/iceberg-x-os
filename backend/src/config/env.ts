import * as dotenv from 'dotenv';
import path from 'path';
import type { Request } from 'express';

dotenv.config();

/**
 * Reads a required environment variable. The process exits on boot when the
 * variable is missing, so a deployment can never silently fall back to a
 * hardcoded value.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(
      `[config] Missing required environment variable: ${name}. ` +
      `Set it before starting the server.`
    );
    process.exit(1);
  }
  return value.trim();
}

export const JWT_SECRET = requireEnv('JWT_SECRET');

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PROD = NODE_ENV === 'production';

/** Strips quotes and trailing slashes, and adds a scheme to a bare domain. */
function normalizeOrigin(value?: string | null): string | null {
  if (!value) return null;
  let url = value.replace(/['"]/g, '').trim().replace(/\/+$/, '');
  if (!url) return null;
  // Railway exposes RAILWAY_PUBLIC_DOMAIN as a bare host, with no scheme
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

const isLoopback = (origin: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(origin);

const configuredOrigin =
  normalizeOrigin(process.env.APP_URL) ||
  normalizeOrigin(process.env.RAILWAY_PUBLIC_DOMAIN);

/**
 * The public origin of this deployment.
 *
 * Required in production: it is baked into invitation links, which are
 * single-use. A wrong value produces a dead link that has to be reissued, so
 * this must never silently fall back to localhost the way it used to.
 */
if (IS_PROD && !configuredOrigin) {
  console.error(
    '[config] Missing required environment variable: APP_URL. ' +
    'It is the public address of this deployment (e.g. https://portal.example.com) ' +
    'and is used to build invitation links. Set APP_URL before starting the server.'
  );
  process.exit(1);
}

export const APP_URL = configuredOrigin || 'http://localhost:5001';

/**
 * The origin to put in a link sent to a person.
 *
 * `APP_URL` is authoritative. The request is used only to rescue the case where
 * the configured origin is a loopback address but the server is actually being
 * reached on a real host — otherwise a misconfigured deployment hands out
 * invitation links pointing at localhost, which is exactly what happened.
 * Requires `trust proxy` for the forwarded scheme to be honoured.
 */
export function resolvePublicOrigin(req?: Request): string {
  if (!req) return APP_URL;

  const host = req.get('host');
  if (!host) return APP_URL;

  const requestOrigin = normalizeOrigin(`${req.protocol}://${host}`);
  if (!requestOrigin) return APP_URL;

  if (isLoopback(APP_URL) && !isLoopback(requestOrigin)) {
    console.warn(
      `[config] APP_URL is "${APP_URL}" but this request arrived on "${requestOrigin}". ` +
      `Using the request origin so the link works. Set APP_URL to the public address.`
    );
    return requestOrigin;
  }

  return APP_URL;
}

/**
 * The directory where uploaded files (avatars, documents) are stored.
 * If STORAGE_PATH is provided (e.g., mounted Railway Volume at /data/uploads),
 * that absolute path is used. Defaults to local backend/uploads.
 */
export const STORAGE_PATH = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : path.resolve(__dirname, '../../uploads');

// Roll out the API independently from the frontend.
export const FORUM_ENABLED = process.env.FORUM_ENABLED === 'true';
