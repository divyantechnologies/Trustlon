import { GUEST_CART_STORAGE_KEY } from '@/features/auth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The visitor's guest token: identifies their cart and recently viewed list before sign-in.
 * Stored under the same key the auth feature sends at sign-in, so the API can merge both.
 */
export function getGuestToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (saved && UUID.test(saved)) return saved;
    const token = newUuid();
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, token);
    return token;
  } catch {
    return null;
  }
}

/** Read and write small JSON values in localStorage without ever throwing. */
export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable; the value lives only for this visit.
  }
}
