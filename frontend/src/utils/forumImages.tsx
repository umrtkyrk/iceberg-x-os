import type { ComponentPropsWithoutRef } from 'react';
import type { ExtraProps } from 'react-markdown';
import { api } from './api';
import { getAssetUrl } from './assets';

export const FORUM_IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';
export const FORUM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Only images uploaded to the portal are shown; external images could track readers. */
const FORUM_IMAGE_PATH = /^\/uploads\/forum\/[0-9a-f-]{36}\.(?:png|jpg|webp|gif)$/;
export const isForumImage = (src: unknown): src is string => typeof src === 'string' && FORUM_IMAGE_PATH.test(src);

/** Uploads an image and returns the Markdown that shows it. */
export async function uploadForumImage(file: File): Promise<string> {
  if (!FORUM_IMAGE_TYPES.split(',').includes(file.type)) throw new Error('Only PNG, JPEG, WEBP and GIF images can be uploaded.');
  if (file.size > FORUM_IMAGE_MAX_BYTES) throw new Error('Images can be up to 5 MB.');
  const form = new FormData();
  form.append('image', file);
  const { url } = await api.upload<{ url: string }>('/forum/images', form);
  const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]()\n]/g, ' ').trim().slice(0, 80) || 'image';
  return `![${alt}](${url})`;
}

const IMAGE = String.raw`!\[[^\]\n]*\]\([^)\n]*\)`;
// The attachment block that ends a body: images on their own lines, after a blank line (or a single
// line break in posts written before attachments existed), or the whole body.
const TRAILING_IMAGES = new RegExp(String.raw`(^|\n\n|\n(?!\n))(${IMAGE}(?:\n${IMAGE})*)\n*$`);

/**
 * Splits a stored body into the text people type and the images attached at its end, so the editor
 * can show attachments as thumbnails instead of Markdown. Splitting `joinImages(text, images)` gives
 * back exactly `text`, including trailing line breaks the person typed.
 */
export function splitImages(stored: string): { text: string; images: string[] } {
  const body = stored || '';
  const match = TRAILING_IMAGES.exec(body);
  if (!match) return { text: body, images: [] };
  return { text: body.slice(0, match.index), images: match[2].split('\n') };
}
export const joinImages = (text: string, images: string[]) => images.length ? `${text}${text ? '\n\n' : ''}${images.join('\n')}` : text;

/** The source and description of one image Markdown snippet. */
export function imageParts(markdown: string): { src: string; alt: string } | null {
  const match = /^!\[([^\]\n]*)\]\(([^)\s]*)\)$/.exec(markdown);
  return match ? { alt: match[1], src: match[2] } : null;
}

/** The first portal-uploaded image in a body, for feed cards. */
export function firstForumImage(text: string): { src: string; alt: string } | null {
  for (const match of (text || '').matchAll(/!\[([^\]\n]*)\]\(([^)\s]*)\)/g)) {
    if (isForumImage(match[2])) return { src: getAssetUrl(match[2]) || match[2], alt: match[1] };
  }
  return null;
}

/** Removes image Markdown from text, for one-line previews. */
export const stripImages = (text: string) => (text || '').replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, ' ');

/** ReactMarkdown `img` renderer: portal uploads only. */
export function ForumImage({ node: _node, src, alt }: ComponentPropsWithoutRef<'img'> & ExtraProps) {
  if (!isForumImage(src)) return null;
  const url = getAssetUrl(src) || src;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="forum-image"><img src={url} alt={alt || ''} loading="lazy"/></a>;
}
