import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { PublicProfile as Profile } from './types';

const cache = new Map<string, Profile>();
const listeners = new Set<() => void>();

/** Resolves display info (name, avatar) for a set of user ids, with a shared in-memory cache. */
export function useProfilesByIds(ids: (string | null | undefined)[]) {
  const [, force] = useState(0);
  const key = Array.from(new Set(ids.filter(Boolean) as string[])).sort().join(',');

  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  useEffect(() => {
    const missing = key ? key.split(',').filter((id) => !cache.has(id)) : [];
    if (!missing.length) return;
    let active = true;
    supabase
      .from('public_profiles')
      .select('*')
      .in('id', missing)
      .then(({ data }) => {
        if (!active || !data) return;
        data.forEach((p: any) => cache.set(p.id, p as Profile));
        listeners.forEach((l) => l());
      });
    return () => {
      active = false;
    };
  }, [key]);

  const map: Record<string, Profile | undefined> = {};
  if (key) key.split(',').forEach((id) => (map[id] = cache.get(id)));
  return map;
}

export function primeProfile(p: Profile) {
  cache.set(p.id, p);
  listeners.forEach((l) => l());
}
