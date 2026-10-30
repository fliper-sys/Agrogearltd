import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getPosition, hasGeolocation } from '@/lib/geo';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

const MIN_INTERVAL_MS = 4000;
const MAX_SHARE_MS = 4 * 60 * 60 * 1000; // sharing switches itself off after 4 hours

type LiveShareState = {
  sharingConversationId: number | null;
  start: (conversationId: number) => Promise<{ error?: string }>;
  stop: () => Promise<void>;
};

const LiveShareContext = createContext<LiveShareState | null>(null);

const num = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : null);

export function LiveShareProvider({ children }: { children: React.ReactNode }) {
  const { user, displayName } = useAuth();
  const [sharingId, setSharingId] = useState<number | null>(null);
  const idRef = useRef<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastSent = useRef(0);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(user);
  const nameRef = useRef(displayName);
  userRef.current = user;
  nameRef.current = displayName;

  const clearWatch = () => {
    if (watchRef.current != null && hasGeolocation()) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    if (expiry.current) clearTimeout(expiry.current);
    expiry.current = null;
  };

  const sendSystem = async (cid: number, body: string) => {
    const u = userRef.current;
    if (!u) return;
    await supabase.from('messages').insert({ conversation_id: cid, sender_id: u.id, kind: 'system', body });
  };

  const stop = useCallback(async () => {
    const cid = idRef.current;
    clearWatch();
    idRef.current = null;
    setSharingId(null);
    const u = userRef.current;
    if (cid && u) {
      await supabase
        .from('live_shares')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('conversation_id', cid)
        .eq('user_id', u.id);
      await sendSystem(cid, `📍 ${nameRef.current || 'A user'} stopped sharing live location`);
    }
  }, []);

  const start = useCallback(
    async (conversationId: number) => {
      const u = userRef.current;
      if (!u) return { error: 'Sign in first.' };
      if (idRef.current && idRef.current !== conversationId) await stop();
      if (idRef.current === conversationId) return {};

      let first: GeolocationCoordinates;
      try {
        first = await getPosition(); // triggers the browser permission prompt
      } catch (e: any) {
        return { error: e?.message ?? 'Could not get your location.' };
      }

      const push = (c: GeolocationCoordinates) =>
        supabase.from('live_shares').upsert(
          {
            conversation_id: conversationId,
            user_id: u.id,
            latitude: c.latitude,
            longitude: c.longitude,
            accuracy: num(c.accuracy),
            heading: num(c.heading),
            speed: num(c.speed),
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'conversation_id,user_id' },
        );

      const { error } = await push(first);
      if (error) return { error: error.message };

      idRef.current = conversationId;
      setSharingId(conversationId);
      lastSent.current = Date.now();
      await sendSystem(conversationId, `📍 ${nameRef.current || 'A user'} started sharing live location`);

      watchRef.current = navigator.geolocation.watchPosition(
        (p) => {
          const now = Date.now();
          if (now - lastSent.current < MIN_INTERVAL_MS) return;
          lastSent.current = now;
          push(p.coords);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      );
      expiry.current = setTimeout(() => {
        stop();
      }, MAX_SHARE_MS);
      return {};
    },
    [stop],
  );

  useEffect(() => {
    if (!user && idRef.current) {
      clearWatch();
      idRef.current = null;
      setSharingId(null);
    }
  }, [user]);

  useEffect(() => () => clearWatch(), []);

  const value = useMemo(() => ({ sharingConversationId: sharingId, start, stop }), [sharingId, start, stop]);
  return <LiveShareContext.Provider value={value}>{children}</LiveShareContext.Provider>;
}

export function useLiveShare() {
  const ctx = useContext(LiveShareContext);
  if (!ctx) throw new Error('useLiveShare must be used inside LiveShareProvider');
  return ctx;
}
