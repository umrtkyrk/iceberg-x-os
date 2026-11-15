import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { STORAGE_PATH } from '../config/env';
import { badRequest, notFound } from '../utils/http';
import { ForumActor } from './forumPolicy';
import { assertForumPosting } from './forumIdentity.service';
import { chatAttachmentSelect, withChatMember } from './forumChat.service';

// This directory has no express.static mount. Never return storage keys to the client.
const directory = path.resolve(STORAGE_PATH, 'private-chat');
export const CHAT_FILE_MAX_BYTES = 10 * 1024 * 1024;
function storedPath(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw notFound('File not found.');
  return path.join(directory, key);
}
export async function uploadChatFile(actor: ForumActor, roomId: string, file: { buffer: Buffer; originalname: string }) {
  await assertForumPosting(actor);
  if (!file.buffer.length || file.buffer.length > CHAT_FILE_MAX_BYTES) throw badRequest('Choose a non-empty file up to 10 MB.');
  const name = path.basename(file.originalname.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160).trim() || 'attachment';
  // Check before writing, then check again under the membership lock before committing.
  await withChatMember(actor, roomId, async () => undefined);
  const key = randomUUID();
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(storedPath(key), file.buffer, { flag: 'wx' });
  try {
    return await withChatMember(actor, roomId, tx => tx.forumChatAttachment.create({
      data: { room_id: roomId, uploader_id: actor.id, original_name: name, byte_size: file.buffer.length, storage_key: key }, select: chatAttachmentSelect
    }));
  } catch (error) { await fs.unlink(storedPath(key)).catch(() => {}); throw error; }
}
export async function chatFile(actor: ForumActor, roomId: string, id: string) {
  return withChatMember(actor, roomId, async tx => {
    const file = await tx.forumChatAttachment.findFirst({ where: { id, room_id: roomId }, include: { message: { select: { deleted_at: true } } } });
    if (!file || (file.message_id ? !file.message || file.message.deleted_at : file.uploader_id !== actor.id)) throw notFound('File not found.');
    return { path: storedPath(file.storage_key), name: file.original_name };
  });
}
export async function discardChatFile(actor: ForumActor, roomId: string, id: string) {
  const key = await withChatMember(actor, roomId, async tx => {
    const file = await tx.forumChatAttachment.findFirst({ where: { id, room_id: roomId, uploader_id: actor.id, message_id: null } });
    if (!file) throw notFound('Pending file not found.');
    await tx.forumChatAttachment.delete({ where: { id } });
    return file.storage_key;
  });
  await fs.unlink(storedPath(key)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  return { ok: true };
}
