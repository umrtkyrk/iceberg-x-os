export interface ForumPreferences { badgeIds: string[]; signature: string }

export function sanitisePreferences(value: unknown, earnedIds: string[]): ForumPreferences {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const selected = Array.isArray(record.badgeIds) ? record.badgeIds : [];
  return {
    badgeIds: [...new Set(selected.filter((id): id is string => typeof id === 'string' && earnedIds.includes(id)))].slice(0, 3),
    signature: typeof record.signature === 'string' ? record.signature.slice(0, 140) : '',
  };
}

function matchesSample(value: unknown, sample: unknown, key = ''): boolean {
  if (value === null && key === 'questId') return true;
  if (sample === null) return value === null || typeof value === 'string';
  if (Array.isArray(sample)) {
    return Array.isArray(value) && value.every(item => sample.length ? matchesSample(item, sample[0]) : typeof item === 'string');
  }
  if (sample && typeof sample === 'object') {
    return !!value && typeof value === 'object' && !Array.isArray(value)
      && Object.entries(sample).every(([key, entry]) => matchesSample((value as Record<string, unknown>)[key], entry, key));
  }
  return typeof value === typeof sample;
}

export function parseStored<T>(raw: string | null, fallback: T): T {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return matchesSample(parsed, fallback) ? parsed as T : fallback;
  } catch { return fallback; }
}

// UI convenience only; real forum permissions must also be enforced by its API.
export function canStartTopic(role: string, categoryId: string): boolean {
  return ['CUBE', 'ADMIN', 'MENTOR'].includes(role)
    && (categoryId !== 'announcements' || role === 'ADMIN' || role === 'MENTOR');
}
