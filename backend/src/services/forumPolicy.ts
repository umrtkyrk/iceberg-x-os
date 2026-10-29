import { badRequest, forbidden } from '../utils/http';

export interface ForumActor { id: string; role: 'ADMIN' | 'MENTOR' | 'CUBE' }
export const isForumStaff = (actor: ForumActor) => ['ADMIN', 'MENTOR'].includes(actor.role);

export function forumText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw badRequest(`${label} must be ${min}–${max} characters.`);
  }
  return value.trim();
}

export function assertForumAuthor(actor: ForumActor, authorId: string | null) {
  if (actor.id !== authorId) throw forbidden('You can only edit your own posts.');
}

export function assertForumCategory(actor: ForumActor, staffOnly: boolean) {
  if (staffOnly && !isForumStaff(actor)) throw forbidden('Only Mentors and Admins can start topics in this forum.');
}

export function forumPage(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^[1-9]\d{0,4}$/.test(value)) throw badRequest('Invalid page.');
  return Number(value);
}
