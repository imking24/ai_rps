import { isMatch, type Match } from './engine';
export const HISTORY_KEY = 'rps.history.v1';
export const ACTIVE_KEY = 'rps.active.v1';
export function readHistory(): Match[] {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every(m => isMatch(m) && m.phase === 'finished')) throw new Error('invalid history');
  return value;
}
export function readActive(): Match | null {
  const raw = localStorage.getItem(ACTIVE_KEY);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!isMatch(value)) throw new Error('invalid active match');
  return value;
}
export function saveCompleted(match: Match): Match[] {
  const previous = readHistory();
  if (previous.some(item => item.id === match.id)) return previous;
  const updated = [match, ...previous];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}
