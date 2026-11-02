// Keep old notification URLs usable while generating English URLs for new links.
export function forumLocation(params: URLSearchParams) {
  const raw = Number(params.get('page'));
  return {
    topic: params.get('topic') || params.get('konu'),
    reply: params.get('reply') || params.get('yanit'),
    page: Number.isInteger(raw) && raw > 0 && raw < 100000 ? raw : 1,
  };
}

export function forumPageParams(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  // A notification target resolves its own page. Remove it when browsing other pages.
  next.delete('reply'); next.delete('yanit');
  next.set('page', String(page));
  return Object.fromEntries(next);
}

export function forumReadStatus(lastActivity: string, readAt?: string) {
  return !readAt ? 'New' : new Date(lastActivity) > new Date(readAt) ? 'Unread' : null;
}
