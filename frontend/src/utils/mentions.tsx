import type { ComponentPropsWithoutRef } from 'react';
import type { ExtraProps } from 'react-markdown';

/**
 * Mentions are stored in a post body as a Markdown link whose target is the
 * handle: `[@Medine Kaynak](@cube-018)`. The backend's notification parser
 * already accepts a handle that follows "(", so these still notify people.
 * While writing, the editor shows only `@Medine Kaynak` and keeps the
 * name → handle map on the side.
 */
const MENTION_LINK = /\[@([^\]\n]{1,80})\]\(@(cube-\d{1,6}|user-[a-f0-9-]{36})\)/gi;

export type MentionMap = Map<string, string>;

/** Strips characters that would break the stored Markdown link. */
export const mentionName = (name: string) => name.replace(/[[\]\n]/g, '').trim().slice(0, 80);

/** Stored body → text shown in the editor; records each mention in `known`. */
export function decodeMentions(stored: string, known: MentionMap) {
  return stored.replace(MENTION_LINK, (_, name: string, handle: string) => { known.set(name, handle.toLowerCase()); return `@${name}`; });
}

/** Stored body → plain text with `@Name`, for feed previews. */
export const mentionsToText = (stored: string) => (stored || '').replace(MENTION_LINK, '@$1');

/**
 * Extra characters the stored mention links add on top of the visible text. The server limits the
 * stored body, so the editor's visible limit is the stored limit minus this overhead.
 */
export const mentionOverhead = (stored: string) => (stored || '').length - mentionsToText(stored).length;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches `@Name` for any known name, longest first, not followed by a letter or digit. */
export function mentionPattern(names: Iterable<string>) {
  const list = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  return list.length ? new RegExp(`(^|[\\s(])@(${list.map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'gu') : null;
}

/** Editor text → stored body, leaving fenced/indented code blocks and inline code untouched. */
export function encodeMentions(text: string, known: MentionMap, maxLength?: number) {
  let current = maxLength !== undefined ? text.slice(0, maxLength) : text;
  const pattern = mentionPattern(known.keys());
  const encode = (input: string) => {
    if (!pattern) return input;
    let fence: { marker: string; length: number } | null = null;
    return input.split(/(\r?\n)/).map(part => {
      if (part === '\n' || part === '\r\n') return part;
      const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(part);
      if (fence) {
        if (delimiter && delimiter[1][0] === fence.marker && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = null;
        return part;
      }
      if (delimiter) { fence = { marker: delimiter[1][0], length: delimiter[1].length }; return part; }
      if (/^(?: {4}|\t)/.test(part)) return part;
      return part.split(/((?:`+)[\s\S]*?(?:`+)(?!`))/g).map((segment, i) =>
        i % 2 === 1 ? segment : segment.replace(pattern, (_, before: string, name: string) => `${before}[@${name}](@${known.get(name)})`)
      ).join('');
    }).join('');
  };
  let encoded = encode(current);
  while (maxLength !== undefined && encoded.length > maxLength && current.length > 0) {
    current = current.slice(0, Math.max(0, current.length - Math.max(1, encoded.length - maxLength)));
    encoded = encode(current);
  }
  return encoded;
}

/** Validate the complete proposed edit; never shorten a user's message to fit. */
export function encodeMentionsWithinLimit(text: string, known: MentionMap, maxLength?: number) {
  const encoded = encodeMentions(text, known);
  return maxLength !== undefined && encoded.length > maxLength ? null : encoded;
}

/** ReactMarkdown `a` renderer that shows mention links as pink names. */
export function MentionAwareLink({ node: _node, href, children, ...props }: ComponentPropsWithoutRef<'a'> & ExtraProps) {
  if (href?.startsWith('@')) return <span className="mention-tag" title={href.startsWith('@cube-') ? `Cube #${href.slice(6)}` : 'Team member'}>{children}</span>;
  // A scheme-less web address must not resolve as a route inside the portal.
  const value = href?.trim() || '';
  const webAddress = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(value);
  const url = webAddress ? 'https://' + value : value;
  if (!url || /^(?:javascript|data|vbscript):/i.test(url)) return <span>{children}</span>;
  const external = /^(?:https?:)?\/\//i.test(url);
  return <a {...props} href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
}
