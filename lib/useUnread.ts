import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from './supabase';

/** Unread chat messages per conversation for the signed-in user, refreshed periodically. */
export function useUnreadCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<number, number>>({});

  const reload = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return setCounts({});
    const { data } = await supabase.rpc('unread_counts');
    const next: Record<number, number> = {};
    ((data as any[]) ?? []).forEach((r) => (next[Number(r.conversation_id)] = Number(r.unread)));
    setCounts(next);
  }, [user]);

  useEffect(() => {
    reload();
    if (!user) return;
    const t = setInterval(reload, 20000);
    return () => clearInterval(t);
  }, [reload, user]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total, reload };
}
