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

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches `@Name` for any known name, longest first, not followed by a letter or digit. */
export function mentionPattern(names: Iterable<string>) {
  const list = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  return list.length ? new RegExp(`(^|[\\s(])@(${list.map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'gu') : null;
}

/** Editor text → stored body. */
export function encodeMentions(text: string, known: MentionMap) {
  const pattern = mentionPattern(known.keys());
  return pattern ? text.replace(pattern, (_, before: string, name: string) => `${before}[@${name}](@${known.get(name)})`) : text;
}

/** ReactMarkdown `a` renderer that shows mention links as pink names. */
export function MentionAwareLink({ node: _node, href, children, ...props }: ComponentPropsWithoutRef<'a'> & ExtraProps) {
  if (href?.startsWith('@')) return <span className="mention-tag" title={href.startsWith('@cube-') ? `Cube #${href.slice(6)}` : 'Team member'}>{children}</span>;
  return <a href={href} {...props}>{children}</a>;
}
