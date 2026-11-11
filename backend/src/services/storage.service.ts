import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { STORAGE_PATH } from '../config/env';

// Subdirectories under STORAGE_PATH
const AVATARS_DIR = path.join(STORAGE_PATH, 'avatars');
const DOCUMENTS_DIR = path.join(STORAGE_PATH, 'documents');
const FORUM_IMAGES_DIR = path.join(STORAGE_PATH, 'forum');

/**
 * Initializes and ensures storage directories exist.
 */
export function ensureStorageDirectories(): void {
  try {
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }
    if (!fs.existsSync(AVATARS_DIR)) {
      fs.mkdirSync(AVATARS_DIR, { recursive: true });
    }
    if (!fs.existsSync(DOCUMENTS_DIR)) {
      fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
    }
    if (!fs.existsSync(FORUM_IMAGES_DIR)) {
      fs.mkdirSync(FORUM_IMAGES_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('[StorageService] Error creating storage directories:', error);
  }
}

// Ensure directories on module import
ensureStorageDirectories();

export interface SavedDocumentResult {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export class StorageService {
  /**
   * Returns the directory where avatars are stored.
   */
  static getAvatarsDir(): string {
    return AVATARS_DIR;
  }

  /**
   * Returns the directory where private documents are stored.
   */
  static getDocumentsDir(): string {
    return DOCUMENTS_DIR;
  }

  /**
   * Returns the directory where forum post images are stored.
   */
  static getForumImagesDir(): string {
    return FORUM_IMAGES_DIR;
  }

  /**
   * Saves an image attached to a forum post under a random name.
   * Publicly accessible via /uploads/forum/:filename. The caller must have
   * verified the file contents; `extension` comes from that check, never from the client.
   */
  static async saveForumImage(buffer: Buffer, extension: 'png' | 'jpg' | 'webp' | 'gif'): Promise<{ relativeUrl: string }> {
    ensureStorageDirectories();
    const filename = `${crypto.randomUUID()}.${extension}`;
    await fs.promises.writeFile(path.join(FORUM_IMAGES_DIR, filename), buffer, { flag: 'wx' });
    return { relativeUrl: `/uploads/forum/${filename}` };
  }

  /**
   * Saves an avatar image from a binary Buffer.
   * Publicly accessible via /uploads/avatars/:filename
   */
  static async saveAvatar(identifier: string, buffer: Buffer, extension: string): Promise<{ filename: string; relativeUrl: string }> {
    ensureStorageDirectories();
    const cleanExt = extension.replace(/^\./, '').toLowerCase() || 'png';
    const filename = `${identifier}_${Date.now()}.${cleanExt}`;
    const targetPath = path.join(AVATARS_DIR, filename);

    await fs.promises.writeFile(targetPath, buffer);
    return {
      filename,
      relativeUrl: `/uploads/avatars/${filename}`,
    };
  }

  /**
   * Saves a confidential document (PDF, PNG, JPG, etc.) to the private documents directory.
   * Generates a collision-resistant UUID filename to prevent direct guessing.
   */
  static async saveDocument(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<SavedDocumentResult> {
    ensureStorageDirectories();
    const ext = path.extname(originalName).toLowerCase() || '.pdf';
    const uniqueId = crypto.randomUUID();
    const storedFileName = `${uniqueId}${ext}`;
    const targetPath = path.join(DOCUMENTS_DIR, storedFileName);

    await fs.promises.writeFile(targetPath, fileBuffer);

    return {
      fileName: path.basename(originalName),
      filePath: storedFileName, // Store relative filename for portability across volume mounts
      fileSize: fileBuffer.length,
      mimeType,
    };
  }

  /**
   * Resolves the absolute path for a stored document, strictly enforcing
   * that it stays within DOCUMENTS_DIR to prevent directory traversal.
   */
  static resolveDocumentPath(storedFileName: string): string | null {
    // Sanitize: take only the basename to prevent path traversal like "../../etc/passwd"
    const safeName = path.basename(storedFileName);
    const resolved = path.resolve(DOCUMENTS_DIR, safeName);

    if (!resolved.startsWith(DOCUMENTS_DIR)) {
      return null;
    }

    if (!fs.existsSync(resolved)) {
      return null;
    }

    return resolved;
  }

  /**
   * Safely deletes a document file from storage if it exists.
   */
  static async deleteDocument(storedFileName: string): Promise<boolean> {
    try {
      const filePath = this.resolveDocumentPath(storedFileName);
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[StorageService] Error deleting document ${storedFileName}:`, error);
      return false;
    }
  }

  /**
   * Checks if an avatar URL is valid and its file actually exists in storage.
   * Handles relative /uploads/avatars paths, legacy paths, and external URLs.
   */
  static avatarExists(relativeUrlOrFilename?: string | null): boolean {
    if (!relativeUrlOrFilename || typeof relativeUrlOrFilename !== 'string') return false;
    const trimmed = relativeUrlOrFilename.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'none') {
      return false;
    }
    const lower = trimmed.toLowerCase();
    if (lower.includes('default-avatar') || lower.includes('avatar-placeholder') || lower.includes('placeholder')) {
      return false;
    }

    // External URL (http:// or https://)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return true;
    }

    // Local /uploads/avatars/:filename
    try {
      const filename = path.basename(trimmed);
      if (!filename || filename === '.' || filename === '..') return false;
      const primaryPath = path.resolve(AVATARS_DIR, filename);
      const legacyPath = path.resolve(__dirname, '../../uploads/avatars', filename);
      const legacyPath2 = path.resolve(__dirname, '../uploads/avatars', filename);

      return (
        (primaryPath.startsWith(AVATARS_DIR) && fs.existsSync(primaryPath)) ||
        fs.existsSync(legacyPath) ||
        fs.existsSync(legacyPath2)
      );
    } catch {
      return false;
    }
  }

  /**
   * Safely deletes an avatar file from storage if it exists.
   */
  static async deleteAvatar(relativeUrlOrFilename: string): Promise<boolean> {
    try {
      const filename = path.basename(relativeUrlOrFilename);
      const filePath = path.resolve(AVATARS_DIR, filename);
      if (filePath.startsWith(AVATARS_DIR) && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[StorageService] Error deleting avatar ${relativeUrlOrFilename}:`, error);
      return false;
    }
  }
}
