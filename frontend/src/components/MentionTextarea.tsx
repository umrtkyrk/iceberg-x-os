import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { mentionName, mentionPattern } from '../utils/mentions';

interface Person { id: string; name: string; handle: string }

interface MentionTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /** Names already mentioned in the text; these are highlighted. */
  mentionNames: string[];
  /** Called before onChange when a person is picked. */
  onMention: (name: string, handle: string) => void;
}

/** Text in front of the caret that is being typed as a mention, e.g. "@Med". */
export function activeQuery(text: string, caret: number) {
  const match = /(?:^|[\s(])@([^\s@[\]()][^\n@[\]()]{0,39})?$/u.exec(text.slice(0, caret));
  if (!match) return null;
  const query = match[1] || '';
  if (query.split(' ').length > 3) return null;
  return { start: caret - query.length - 1, query };
}

const COPIED_STYLES = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'word-spacing',
  'text-transform', 'text-indent', 'tab-size', 'padding-top', 'padding-left', 'padding-bottom', 'box-sizing',
  'border-top-width', 'border-left-width', 'border-bottom-width', 'border-right-width'];

/**
 * A textarea that suggests people when "@" is typed and shows mentioned names in pink.
 * The text is drawn by an overlay on top of a transparent-text textarea, so the
 * caret, selection and native editing all stay the textarea's own.
 */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(function MentionTextarea(
  { value, onChange, mentionNames, onMention, onKeyDown, onBlur, onScroll, style, ...props }, forwardedRef) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement);
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const listId = `${props.id || 'mention'}-people`;
  const open = !!query && query.start !== dismissed && !props.disabled;

  const syncOverlay = () => {
    const textarea = ref.current, layer = overlay.current;
    if (!textarea || !layer) return;
    const computed = getComputedStyle(textarea);
    for (const name of COPIED_STYLES) layer.style.setProperty(name, computed.getPropertyValue(name));
    const borders = parseFloat(computed.borderLeftWidth) + parseFloat(computed.borderRightWidth);
    const scrollbar = Math.max(0, textarea.offsetWidth - textarea.clientWidth - borders);
    layer.style.paddingRight = `${parseFloat(computed.paddingRight) + scrollbar}px`;
    layer.style.top = `${textarea.offsetTop}px`;
    layer.style.left = `${textarea.offsetLeft}px`;
    layer.style.width = `${textarea.offsetWidth}px`;
    layer.style.height = `${textarea.offsetHeight}px`;
    layer.scrollTop = textarea.scrollTop;
  };
  useLayoutEffect(syncOverlay);
  useEffect(() => {
    const textarea = ref.current;
    if (!textarea || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(syncOverlay);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, []);

  const term = open ? query.query.trim() : '';
  useEffect(() => {
    setPeople([]); setActive(0); setFailed(false); setLoading(!!term);
    if (!term) return;
    let current = true;
    const timer = setTimeout(() => {
      void api.get<Person[]>(`/forum/mentions?q=${encodeURIComponent(term)}`)
        .then(rows => { if (current) setPeople(rows); })
        .catch(() => { if (current) setFailed(true); })
        .finally(() => { if (current) setLoading(false); });
    }, 200);
    return () => { current = false; clearTimeout(timer); };
  }, [term]);

  const updateQuery = (typing: boolean) => {
    const textarea = ref.current;
    if (!textarea) return;
    const next = activeQuery(textarea.value, textarea.selectionStart);
    if (typing) {
      if (!next) setDismissed(null);
      else if (dismissed !== null && next.start !== dismissed) setDismissed(null);
      setQuery(next);
    } else if (query && (!next || next.start !== query.start)) {
      setQuery(null);
    }
  };

  const pick = (person: Person) => {
    const textarea = ref.current;
    if (!textarea || !query) return;
    const name = mentionName(person.name);
    const caret = textarea.selectionStart;
    const inserted = `@${name} `;
    onMention(name, person.handle);
    onChange(value.slice(0, query.start) + inserted + value.slice(caret));
    setDismissed(query.start);
    setQuery(null);
    const position = query.start + inserted.length;
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(position, position); });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && people.length) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => (i + 1) % people.length); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => (i - 1 + people.length) % people.length); return; }
      if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); pick(people[active]); return; }
    }
    if (open && event.key === 'Escape') { event.preventDefault(); setDismissed(query.start); return; }
    onKeyDown?.(event);
  };

  const markerAt = open ? query.start : -1;
  const highlighted = useMemo(() => {
    const parts: React.ReactNode[] = [];
    // Plain text, with a zero-width marker where the typed "@" is, so the list can sit under that line.
    const plain = (from: number, to: number) => {
      if (markerAt >= from && markerAt < to) parts.push(value.slice(from, markerAt), <span key="marker" ref={marker}/>, value.slice(markerAt, to));
      else parts.push(value.slice(from, to));
    };
    const pattern = mentionPattern(mentionNames);
    let last = 0;
    if (pattern) for (const match of value.matchAll(pattern)) {
      const at = (match.index ?? 0) + match[1].length;
      plain(last, at);
      parts.push(<mark key={at} className="mention-tag">{`@${match[2]}`}</mark>);
      last = at + match[2].length + 1;
    }
    plain(last, value.length);
    if (markerAt === value.length) parts.push(<span key="marker" ref={marker}/>);
    return parts;
  }, [value, mentionNames, markerAt]);

  const [listPosition, setListPosition] = useState<React.CSSProperties>({ bottom: 8 });
  useLayoutEffect(() => {
    const textarea = ref.current, layer = overlay.current, spot = marker.current;
    if (!open || !textarea || !layer || !spot) return;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 18;
    const lineTop = textarea.offsetTop + spot.offsetTop - layer.scrollTop;
    const below = lineTop + lineHeight + 4;
    const room = textarea.offsetTop + textarea.offsetHeight - below;
    // Open under the line when it fits, otherwise above it.
    setListPosition(room >= 120 ? { top: below } : { bottom: Math.max(4, textarea.offsetTop + textarea.offsetHeight - lineTop + 4) });
  }, [open, markerAt, value]);

  const hint = loading ? 'Searching…' : failed ? 'People could not be loaded.' : !term ? 'Type a name to mention a Cube or team member.' : !people.length && !term.includes(' ') ? 'No matching Cubes or team members.' : '';
  const showList = open && (people.length > 0 || !!hint);

  return <>
    <textarea
      {...props}
      ref={ref}
      value={value}
      onChange={event => { onChange(event.target.value); requestAnimationFrame(() => updateQuery(true)); }}
      onSelect={() => updateQuery(false)}
      onKeyDown={handleKeyDown}
      onBlur={event => { setQuery(null); onBlur?.(event); }}
      onScroll={event => { if (overlay.current) overlay.current.scrollTop = event.currentTarget.scrollTop; onScroll?.(event); }}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={showList}
      aria-controls={listId}
      aria-activedescendant={open && people[active] ? `${listId}-${people[active].id}` : undefined}
      style={{ ...style, color: 'transparent', caretColor: '#1f2937' }}
    />
    <div ref={overlay} aria-hidden="true" className="absolute pointer-events-none overflow-hidden whitespace-pre-wrap break-words m-0 border-solid border-transparent text-gray-800">
      {highlighted}{'​'}
    </div>
    {showList && <div style={listPosition} onMouseDown={event => event.preventDefault()} className="absolute left-3 right-3 z-20 max-h-28 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg text-xs">
      {hint && <p className="px-3 py-2 text-gray-500" role="status">{hint}</p>}
      <ul id={listId} role="listbox" aria-label="People to mention">
        {people.map((person, index) => <li key={person.id} id={`${listId}-${person.id}`} role="option" aria-selected={index === active}
          onMouseDown={event => { event.preventDefault(); pick(person); }} onMouseEnter={() => setActive(index)}
          className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer ${index === active ? 'bg-pink-50 text-magenta' : 'text-gray-800'}`}>
          <span className="font-bold">{person.name}</span>
          <small className="text-gray-500">{person.handle.startsWith('cube-') ? `Cube #${person.handle.slice(5)}` : 'Team member'}</small>
        </li>)}
      </ul>
    </div>}
  </>;
});
