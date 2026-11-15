/**
 * Files attached to progress updates and demo submissions.
 *
 * Flow: the browser uploads each file to POST /attachments, which stores it
 * with no owner and returns its id; the update or demo is then created with
 * `attachment_ids`, and claimAttachments() attaches them inside the same
 * transaction. Unclaimed uploads older than a day are swept.
 *
 * Who can open a file: staff, the uploader, and Cubes on the mission's team.
 * That is stricter than who can read the update text on a mission page, on
 * purpose: files can carry client material.
 */
import type { Prisma } from '@prisma/client';
import prisma from './prisma';
import { StorageService } from './storage.service';
import { badRequest } from '../utils/http';

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ITEM = 5;
/** Uploads not sent with an update or demo within this window are removed. */
export const UNCLAIMED_TTL_MS = 24 * 60 * 60 * 1000;
/** Cap on files a person can have waiting to be sent. */
export const MAX_UNCLAIMED_PER_USER = 20;

export type AttachmentKind = 'image' | 'pdf' | 'docx';

export interface DetectedFile {
  kind: AttachmentKind;
  extension: 'png' | 'jpg' | 'webp' | 'gif' | 'pdf' | 'docx';
  mime: string;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Identifies a file from its first bytes. The client's MIME type and file name
 * are never trusted. DOCX is a ZIP whose entry names (stored in plain text)
 * include the Word document part.
 */
export function detectAttachment(buffer: Buffer): DetectedFile | null {
  const starts = (bytes: number[]) => buffer.length >= bytes.length && bytes.every((b, i) => buffer[i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: 'image', extension: 'png', mime: 'image/png' };
  if (starts([0xff, 0xd8, 0xff])) return { kind: 'image', extension: 'jpg', mime: 'image/jpeg' };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { kind: 'image', extension: 'webp', mime: 'image/webp' };
  }
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) {
    return { kind: 'image', extension: 'gif', mime: 'image/gif' };
  }
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { kind: 'pdf', extension: 'pdf', mime: 'application/pdf' };
  if (starts([0x50, 0x4b, 0x03, 0x04]) && buffer.includes('word/document.xml') && buffer.includes('[Content_Types].xml')) {
    return { kind: 'docx', extension: 'docx', mime: DOCX_MIME };
  }
  return null;
}

/** Keeps a readable original name: no path, no control characters, bounded length. */
export function cleanFileName(name: string | undefined, fallbackExtension: string): string {
  const base = (name || '').split(/[\\/]/).pop() || '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim().slice(0, 120);
  return cleaned || `attachment.${fallbackExtension}`;
}

/** Fields safe to send to anyone who can see the attachment exists. */
export const ATTACHMENT_PUBLIC_SELECT = {
  id: true,
  file_name: true,
  mime_type: true,
  kind: true,
  file_size: true,
  created_at: true,
} as const;

/** Removes this person's uploads that were never sent, files included. */
export async function sweepUnclaimed(uploaderId: string, now: Date = new Date()): Promise<void> {
  const stale = await prisma.attachment.findMany({
    where: {
      uploaded_by_id: uploaderId,
      update_id: null,
      demo_submission_id: null,
      created_at: { lt: new Date(now.getTime() - UNCLAIMED_TTL_MS) },
    },
    select: { id: true, stored_name: true },
  });
  if (stale.length === 0) return;
  await prisma.attachment.deleteMany({ where: { id: { in: stale.map(a => a.id) } } });
  await StorageService.deleteAttachments(stale.map(a => a.stored_name));
}

/** Stores a validated upload with no owner yet. */
export async function createUnclaimedAttachment(
  uploaderId: string,
  file: { buffer: Buffer; originalname?: string }
) {
  const detected = detectAttachment(file.buffer);
  if (!detected) throw badRequest('Only images (PNG, JPEG, WEBP, GIF), PDF and Word (.docx) files can be attached.');

  await sweepUnclaimed(uploaderId);
  const waiting = await prisma.attachment.count({
    where: { uploaded_by_id: uploaderId, update_id: null, demo_submission_id: null },
  });
  if (waiting >= MAX_UNCLAIMED_PER_USER) {
    throw badRequest('You have many files waiting to be sent. Send or remove them first.');
  }

  const storedName = await StorageService.saveAttachment(file.buffer, detected.extension);
  try {
    return await prisma.attachment.create({
      data: {
        uploaded_by_id: uploaderId,
        file_name: cleanFileName(file.originalname, detected.extension),
        stored_name: storedName,
        mime_type: detected.mime,
        kind: detected.kind,
        file_size: file.buffer.length,
      },
      select: ATTACHMENT_PUBLIC_SELECT,
    });
  } catch (error) {
    await StorageService.deleteAttachments([storedName]);
    throw error;
  }
}

/** Accepts `attachment_ids` from a request body: absent → [], otherwise unique string ids. */
export function parseAttachmentIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) {
    throw badRequest('attachment_ids must be a list of ids.');
  }
  const ids = [...new Set(value as string[])];
  if (ids.length > MAX_ATTACHMENTS_PER_ITEM) {
    throw badRequest(`You can attach up to ${MAX_ATTACHMENTS_PER_ITEM} files.`);
  }
  return ids;
}

/**
 * Attaches the uploader's own unclaimed files to an update or demo. Run inside
 * the transaction that creates the owner, so a failure leaves nothing behind.
 */
export async function claimAttachments(
  tx: Prisma.TransactionClient,
  ids: string[],
  uploaderId: string,
  owner: { update_id: string } | { demo_submission_id: string }
): Promise<void> {
  if (ids.length === 0) return;
  const claimed = await tx.attachment.updateMany({
    where: { id: { in: ids }, uploaded_by_id: uploaderId, update_id: null, demo_submission_id: null },
    data: owner,
  });
  if (claimed.count !== ids.length) {
    throw badRequest('Some attachments could not be found. Upload them again.');
  }
}

export interface Viewer {
  id: string;
  role: string;
  cubeProfileId?: string;
}

/** Staff, or a Cube on one of the mission's teams. */
export async function canSeeMissionFiles(viewer: Viewer, missionId: string): Promise<boolean> {
  if (viewer.role === 'ADMIN' || viewer.role === 'MENTOR') return true;
  if (viewer.role !== 'CUBE' || !viewer.cubeProfileId) return false;
  const member = await prisma.missionTeamMember.findFirst({
    where: { cube_id: viewer.cubeProfileId, team: { mission_id: missionId } },
    select: { id: true },
  });
  return Boolean(member);
}

/** Whether the viewer may open this attachment's file. */
export async function canOpenAttachment(
  viewer: Viewer,
  attachment: {
    uploaded_by_id: string;
    update: { mission_id: string } | null;
    demo_submission: { mission_id: string } | null;
  }
): Promise<boolean> {
  if (attachment.uploaded_by_id === viewer.id) return true;
  const missionId = attachment.update?.mission_id || attachment.demo_submission?.mission_id;
  if (!missionId) return false; // unclaimed: only the uploader
  return canSeeMissionFiles(viewer, missionId);
}
