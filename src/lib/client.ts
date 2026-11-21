import type { Membership } from '@/lib/multiplayer';
export async function api<T>(url: string, options: { method?: string; body?: unknown; membership?: Membership; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.membership ? { Authorization: `Bearer ${options.membership.token}` } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store', signal: options.signal,
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error ?? 'Something went wrong. Please try again.'), { status: response.status });
  return data as T;
}
export function readStored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(`apex:${key}`); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
export function store(key: string, value: unknown) {
  try { if (value === null) localStorage.removeItem(`apex:${key}`); else localStorage.setItem(`apex:${key}`, JSON.stringify(value)); } catch { /* Private browsing may disable storage. */ }
}
export async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return; }
  const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.appendChild(field); field.select();
  const copied = document.execCommand('copy'); field.remove(); if (!copied) throw new Error('Please select and copy the room code manually.');
}
