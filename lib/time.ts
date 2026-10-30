import { useEffect, useState } from 'react';

export type Parts = { days: number; hours: number; minutes: number; seconds: number; totalMs: number; overdue: boolean };

export function splitMs(ms: number): Parts {
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const s = Math.floor(abs / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    totalMs: ms,
    overdue,
  };
}

/** Ticks once a second and returns time remaining until `target` (negative once passed). */
export function useCountdown(target: string | Date | null | undefined, active = true): Parts | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target || !active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target, active]);
  if (!target) return null;
  return splitMs(new Date(target).getTime() - now);
}

export const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
