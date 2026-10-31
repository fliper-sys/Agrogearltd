import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { VerifiedBadge } from '@/components/Badges';
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
const QUICK_REPLIES = ['Is it still available?', 'Can you deliver it?', 'What is the deposit?', 'Can we agree on a pickup time?', 'Thank you! 🙏'];

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
};

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
  const chanRef = useRef<any>(null);
  const lastTypingSent = useRef(0);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const markRead = useCallback(() => {
    if (cid) supabase.rpc('mark_conversation_read', { p_conversation: cid }).then(() => {});
  }, [cid]);

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
      markRead();
    })();

    const channel = supabase
      .channel(`chat-${cid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${cid}` }, (p: any) => {
        addMessages([p.new as ChatMessage]);
        if (p.new?.sender_id !== user?.id) {
          setOtherTyping(false);
          markRead();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${cid}` }, (p: any) => {
        if (p.new?.id) setMessages((prev) => prev.map((m) => (m.id === p.new.id ? { ...m, read_at: p.new.read_at } : m)));
      })
      .on('broadcast', { event: 'typing' }, (p: any) => {
        if (p.payload?.uid && p.payload.uid !== user?.id) {
          setOtherTyping(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setOtherTyping(false), 4000);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_shares', filter: `conversation_id=eq.${cid}` }, (p: any) => {
        if (p.new && p.new.user_id) applyShare(p.new as LiveShare);
      })
      .subscribe();
    chanRef.current = channel;

    // Safety net in case realtime is unavailable: poll for anything newer every few seconds.
    const poll = setInterval(async () => {
      const [{ data: msgs }, { data: live }] = await Promise.all([
        supabase.from('messages').select('*').eq('conversation_id', cid).gt('id', lastId.current).order('id', { ascending: true }),
        supabase.from('live_shares').select('*').eq('conversation_id', cid),
      ]);
      if (msgs?.length) {
        addMessages(msgs as ChatMessage[]);
        markRead();
      }
      // refresh read receipts on my sent messages
      const { data: recent } = await supabase.from('messages').select('id,read_at').eq('conversation_id', cid).order('id', { ascending: false }).limit(40);
      if (recent) setMessages((prev) => prev.map((m) => { const r = (recent as any[]).find((x) => x.id === m.id); return r && r.read_at !== m.read_at ? { ...m, read_at: r.read_at } : m; }));
      ((live as LiveShare[]) ?? []).forEach(applyShare);
    }, 8000);

    return () => {
      active = false;
      clearInterval(poll);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      chanRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [user, cid, addMessages, applyShare, markRead]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const onType = (v: string) => {
    setText(v);
    const t = Date.now();
    if (v && chanRef.current && t - lastTypingSent.current > 2000) {
      lastTypingSent.current = t;
      chanRef.current.send({ type: 'broadcast', event: 'typing', payload: { uid: user?.id } });
    }
  };

  const send = async (override?: string) => {
    const body = (override ?? text).trim();
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
    if (override === undefined) setText('');
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
              <Pressable onPress={() => otherId && router.push(`/u/${otherId}`)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }, web({ cursor: 'pointer' })]}>
                <Avatar url={other?.avatar_url} name={other?.full_name} size={42} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <T style={{ fontWeight: '800', fontSize: 15 }}>{other?.full_name || 'AgroGear user'}</T>
                    {other?.is_verified ? <VerifiedBadge small /> : null}
                  </View>
                  <T style={{ color: otherTyping ? colors.available : colors.muted, fontSize: 12, fontWeight: otherTyping ? '700' : '400' }}>
                    {otherTyping ? 'typing…' : conv.equipment ? `${conv.equipment.emoji} ${conv.equipment.name} · view profile` : 'Listing removed'}
                  </T>
                </View>
              </Pressable>
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
              {messages.map((m, idx) => {
                const prev = messages[idx - 1];
                const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                const divider = newDay ? (
                  <View key={`d-${m.id}`} style={{ alignSelf: 'center', backgroundColor: '#e9eee3', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10, marginVertical: 6 }}>
                    <T style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>{dayLabel(m.created_at)}</T>
                  </View>
                ) : null;
                if (m.kind === 'system') {
                  return (
                    <React.Fragment key={m.id}>
                      {divider}
                      <T style={{ alignSelf: 'center', color: colors.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 12 }}>
                        {m.body}
                      </T>
                    </React.Fragment>
                  );
                }
                const mine = m.sender_id === user?.id;
                const sameSender = prev && prev.kind === 'text' && prev.sender_id === m.sender_id && !newDay;
                return (
                  <React.Fragment key={m.id}>
                    {divider}
                    <View
                      style={{
                        alignSelf: mine ? 'flex-end' : 'flex-start',
                        maxWidth: '82%',
                        marginTop: sameSender ? -4 : 0,
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
                      <T selectable style={{ color: mine ? '#fff' : colors.ink, lineHeight: 21, fontSize: 14 }}>{m.body}</T>
                      <View style={{ flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 5, marginTop: 4 }}>
                        <T style={{ color: mine ? colors.heroText : colors.muted, fontSize: 10 }}>
                          {new Date(m.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                        </T>
                        {mine ? <T style={{ color: m.read_at ? colors.mint : colors.heroText, fontSize: 11, fontWeight: '800' }}>{m.read_at ? '✓✓' : '✓'}</T> : null}
                      </View>
                    </View>
                  </React.Fragment>
                );
              })}
              {otherTyping ? (
                <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14 }}>
                  <T style={{ color: colors.muted, letterSpacing: 2 }}>● ● ●</T>
                </View>
              ) : null}
            </ScrollView>

            {messages.filter((m) => m.kind === 'text').length < 3 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
                {QUICK_REPLIES.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => send(q)}
                    style={[{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.btnBorder, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 13 }, web({ cursor: 'pointer' })]}
                  >
                    <T style={{ color: colors.green, fontSize: 13, fontWeight: '600' }}>{q}</T>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <ErrorText>{error}</ErrorText>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <TextField
                  value={text}
                  onChangeText={onType}
                  placeholder="Write a message…  (Enter to send)"
                  multiline
                  maxLength={2000}
                  style={{ minHeight: 46, maxHeight: 120 }}
                  onKeyPress={(e: any) => {
                    if (e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
                      e.preventDefault?.();
                      send();
                    }
                  }}
                />
              </View>
              <Button label="Send ➤" onPress={() => send()} loading={sending} disabled={!text.trim()} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}
