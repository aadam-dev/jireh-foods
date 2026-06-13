/** Business-day helpers for POS register sessions (Africa/Accra). */

const BUSINESS_TZ = 'Africa/Accra';

export function businessDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isStaleSession(openedAt: string | Date): boolean {
  const opened = typeof openedAt === 'string' ? new Date(openedAt) : openedAt;
  return businessDateKey(opened) !== businessDateKey(new Date());
}

export type RegisterSessionState = 'none' | 'active' | 'stale';

export function classifyRegisterSession(openedAt: string | Date | null | undefined): RegisterSessionState {
  if (!openedAt) return 'none';
  return isStaleSession(openedAt) ? 'stale' : 'active';
}
