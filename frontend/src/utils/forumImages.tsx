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

/** Removes image Markdown from text, for one-line previews. */
export const stripImages = (text: string) => (text || '').replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, ' ');

/** ReactMarkdown `img` renderer: portal uploads only. */
export function ForumImage({ node: _node, src, alt }: ComponentPropsWithoutRef<'img'> & ExtraProps) {
  if (!isForumImage(src)) return null;
  const url = getAssetUrl(src) || src;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="forum-image"><img src={url} alt={alt || ''} loading="lazy"/></a>;
}
