import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Private room content is stored encrypted (AES-256-GCM). Anyone reading the database or the
 * private-chat upload folder sees only ciphertext; the app decrypts for room members only.
 * The key is FORUM_CHAT_KEY: 32 random bytes, base64 encoded
 * (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
 * Losing or changing the key makes existing room content unreadable, so back it up with the other secrets.
 *
 * Each value is bound to its room (additional authenticated data), so a ciphertext copied into
 * another room fails to decrypt instead of leaking. Rows written before encryption existed are
 * returned unchanged until `npm run db:forum:encrypt-chat` converts them.
 */
const TEXT_PREFIX = 'enc:v1:';
const FILE_MAGIC = Buffer.from('ICXENC1\n');
let cached: Buffer | null = null;

export function forumChatKeyProblem(value = process.env.FORUM_CHAT_KEY): string | null {
  if (!value?.trim()) return 'FORUM_CHAT_KEY is not set.';
  return Buffer.from(value.trim(), 'base64').length === 32 ? null : 'FORUM_CHAT_KEY must be 32 bytes encoded as base64.';
}
function key() {
  if (cached) return cached;
  const problem = forumChatKeyProblem();
  if (problem) throw new Error(`Private chat encryption is not configured: ${problem}`);
  cached = Buffer.from(process.env.FORUM_CHAT_KEY!.trim(), 'base64');
  return cached;
}
const aad = (roomId: string) => Buffer.from(`forum-chat-room:${roomId}`);

function seal(roomId: string, plain: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(aad(roomId));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}
function open(roomId: string, sealed: Buffer) {
  const decipher = createDecipheriv('aes-256-gcm', key(), sealed.subarray(0, 12));
  decipher.setAAD(aad(roomId));
  decipher.setAuthTag(sealed.subarray(12, 28));
  return Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]);
}

export const isSealedText = (value: string | null | undefined) => !!value?.startsWith(TEXT_PREFIX);
export function sealText(roomId: string, plain: string) { return TEXT_PREFIX + seal(roomId, Buffer.from(plain, 'utf8')).toString('base64'); }
export function openText(roomId: string, value: string): string;
export function openText(roomId: string, value: string | null): string | null;
export function openText(roomId: string, value: string | null) {
  if (value === null || !isSealedText(value)) return value;
  try { return open(roomId, Buffer.from(value.slice(TEXT_PREFIX.length), 'base64')).toString('utf8'); }
  catch { return '[This content could not be decrypted]'; }
}
export const isSealedFile = (data: Buffer) => data.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC);
export function sealFile(roomId: string, data: Buffer) { return Buffer.concat([FILE_MAGIC, seal(roomId, data)]); }
export function openFile(roomId: string, data: Buffer) { return isSealedFile(data) ? open(roomId, data.subarray(FILE_MAGIC.length)) : data; }
