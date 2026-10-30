import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { Header } from '@/components/Header';
import MapView from '@/components/MapView';
import { Button, ErrorText, T, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLiveShare } from '@/context/LiveShareContext';
import { formatKm, haversineKm, timeAgo } from '@/lib/geo';
import type { MapMarker } from '@/lib/mapTypes';
import { supabase } from '@/lib/supabase';
import { colors, useBreakpoint, web } from '@/lib/theme';
import type { ChatMessage, Conversation, LiveShare } from '@/lib/types';
import { useProfilesByIds } from '@/lib/useProfiles';

const STALE_MS = 2 * 60 * 1000;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cid = Number(id);
  const { isSm } = useBreakpoint();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { sharingConversationId, start, stop } = useLiveShare();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [shares, setShares] = useState<Record<string, LiveShare>>({});
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const scroller = useRef<any>(null);
  const lastId = useRef(0);

  const otherId = conv && user ? (conv.renter_id === user.id ? conv.owner_id : conv.renter_id) : null;
  const profiles = useProfilesByIds([otherId, user?.id, conv?.owner_id, conv?.renter_id]);
  const other = otherId ? profiles[otherId] : undefined;

  const addMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      const next = [...prev, ...fresh].sort((a, b) => a.id - b.id);
      lastId.current = next[next.length - 1].id;
      return next;
    });
  }, []);

  const applyShare = useCallback((row: LiveShare) => {
    if (row?.user_id) setShares((prev) => ({ ...prev, [row.user_id]: row }));
  }, []);

  useEffect(() => {
    if (!user || !cid) return;
    let active = true;
    (async () => {
      const { data: c } = await supabase
        .from('conversations')
        .select('*, equipment(name, emoji, color)')
        .eq('id', cid)
        .maybeSingle();
      if (!active) return;
      setConv((c as any) ?? null);
      const [{ data: msgs }, { data: live }] = await Promise.all([
        supabase.from('messages').select('*').eq('conversation_id', cid).order('id', { ascending: true }).limit(300),
        supabase.from('live_shares').select('*').eq('conversation_id', cid),
      ]);
      if (!active) return;
      addMessages((msgs as ChatMessage[]) ?? []);
      ((live as LiveShare[]) ?? []).forEach(applyShare);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`chat-${cid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${cid}` }, (p: any) =>
        addMessages([p.new as ChatMessage]),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_shares', filter: `conversation_id=eq.${cid}` }, (p: any) => {
        if (p.new && p.new.user_id) applyShare(p.new as LiveShare);
      })
      .subscribe();

    // Safety net in case realtime is unavailable: poll for anything newer every few seconds.
    const poll = setInterval(async () => {
      const [{ data: msgs }, { data: live }] = await Promise.all([
        supabase.from('messages').select('*').eq('conversation_id', cid).gt('id', lastId.current).order('id', { ascending: true }),
        supabase.from('live_shares').select('*').eq('conversation_id', cid),
      ]);
      if (msgs?.length) addMessages(msgs as ChatMessage[]);
      ((live as LiveShare[]) ?? []).forEach(applyShare);
    }, 8000);

    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [user, cid, addMessages, applyShare]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    const body = text.trim();
    if (!body || !user) return;
    setError(null);
    setSending(true);
    const { data, error: err } = await supabase
      .from('messages')
      .insert({ conversation_id: cid, sender_id: user.id, body, kind: 'text' })
      .select()
      .single();
    setSending(false);
    if (err) return setError(err.message);
    setText('');
    if (data) addMessages([data as ChatMessage]);
  };

  const iAmSharing = sharingConversationId === cid;
  const toggleShare = async () => {
    setError(null);
    setShareBusy(true);
    if (iAmSharing) await stop();
    else {
      const res = await start(cid);
      if (res.error) setError(res.error);
    }
    setShareBusy(false);
  };

  const activeShares = useMemo(
    () => Object.values(shares).filter((s) => s.active && now - new Date(s.updated_at).getTime() < 30 * 60 * 1000),
    [shares, now],
  );

  const markers = useMemo<MapMarker[]>(
    () =>
      activeShares.map((s) => {
        const isOwner = conv ? s.user_id === conv.owner_id : false;
        const mine = s.user_id === user?.id;
        const stale = now - new Date(s.updated_at).getTime() > STALE_MS;
        const name = mine ? 'You' : profiles[s.user_id]?.full_name || 'User';
        return {
          id: `share-${s.user_id}`,
          lat: s.latitude,
          lng: s.longitude,
          emoji: isOwner ? conv?.equipment?.emoji ?? '🚜' : '🧑‍🌾',
          color: isOwner ? conv?.equipment?.color ?? colors.mint : colors.mint,
          label: `${name}${isOwner ? ' · machine' : ''} · ${stale ? 'last seen ' : 'updated '}${timeAgo(s.updated_at, now)}`,
        };
      }),
    [activeShares, conv, user, profiles, now],
  );

  const apart = useMemo(() => {
    if (activeShares.length < 2) return null;
    const [a, b] = activeShares;
    return haversineKm({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude });
  }, [activeShares]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header active="messages" />
      <View style={{ flex: 1, width: '100%', maxWidth: 820, alignSelf: 'center', padding: isSm ? 10 : 20, gap: 12 }}>
        {loading || authLoading ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
        ) : !conv ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, gap: 14, alignItems: 'flex-start' }}>
            <T>This conversation could not be found.</T>
            <Button label="Back to messages" onPress={() => router.replace('/messages')} />
          </View>
        ) : (
          <>
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.line,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Pressable onPress={() => router.replace('/messages')} style={web({ cursor: 'pointer' })}>
                <T style={{ fontSize: 22, color: colors.green, paddingHorizontal: 4 }}>←</T>
              </Pressable>
              <Avatar url={other?.avatar_url} name={other?.full_name} size={42} />
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '800', fontSize: 15 }}>{other?.full_name || 'AgroGear user'}</T>
                <T style={{ color: colors.muted, fontSize: 12 }}>
                  {conv.equipment ? `${conv.equipment.emoji} ${conv.equipment.name}` : 'Listing removed'}
                </T>
              </View>
              <Button
                small
                variant={iAmSharing ? 'primary' : 'secondary'}
                label={iAmSharing ? '■ Stop sharing' : '📍 Share live location'}
                onPress={toggleShare}
                loading={shareBusy}
              />
            </View>

            {activeShares.length ? (
              <View>
                <MapView markers={markers} height={isSm ? 220 : 280} fitKey={`${activeShares.length}`} />
                <T style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
                  🔴 Live · {activeShares.length} sharing
                  {apart != null ? ` · about ${formatKm(apart)} apart` : ''}. Locations update every few seconds while the sharer keeps this app open.
                </T>
              </View>
            ) : null}

            <ScrollView
              ref={scroller}
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
              onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
            >
              {messages.length === 0 ? (
                <T style={{ color: colors.muted, textAlign: 'center', marginTop: 30 }}>
                  Say hello 👋 Ask about availability, delivery and pickup.
                </T>
              ) : null}
              {messages.map((m) => {
                if (m.kind === 'system') {
                  return (
                    <T key={m.id} style={{ alignSelf: 'center', color: colors.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 12 }}>
                      {m.body}
                    </T>
                  );
                }
                const mine = m.sender_id === user?.id;
                return (
                  <View
                    key={m.id}
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      backgroundColor: mine ? colors.green : '#fff',
                      borderWidth: mine ? 0 : 1,
                      borderColor: colors.line,
                      borderRadius: 16,
                      borderBottomRightRadius: mine ? 4 : 16,
                      borderBottomLeftRadius: mine ? 16 : 4,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                    }}
                  >
                    <T style={{ color: mine ? '#fff' : colors.ink, lineHeight: 21, fontSize: 14 }}>{m.body}</T>
                    <T style={{ color: mine ? colors.heroText : colors.muted, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' }}>
                      {new Date(m.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    </T>
                  </View>
                );
              })}
            </ScrollView>

            <ErrorText>{error}</ErrorText>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <TextField value={text} onChangeText={setText} placeholder="Write a message..." onSubmitEditing={send} returnKeyType="send" />
              </View>
              <Button label="Send" onPress={send} loading={sending} disabled={!text.trim()} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}
