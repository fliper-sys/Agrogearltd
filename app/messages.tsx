import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Button, Eyebrow, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/geo';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { colors, useBreakpoint, web } from '@/lib/theme';
import type { Conversation } from '@/lib/types';
import { useProfilesByIds } from '@/lib/useProfiles';
import { useUnreadCounts } from '@/lib/useUnread';

export default function MessagesScreen() {
  const { isSm } = useBreakpoint();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('conversations')
      .select('*, equipment(name, emoji, color)')
      .order('last_message_at', { ascending: false });
    setRows((data as any[]) ?? []);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
      reloadUnread();
    }, [load]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { counts, reload: reloadUnread } = useUnreadCounts();
  const others = rows.map((c) => (c.renter_id === user?.id ? c.owner_id : c.renter_id));
  const profiles = useProfilesByIds(others);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header active="messages" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ width: '100%', maxWidth: 820, alignSelf: 'center', padding: isSm ? 14 : 28, paddingBottom: 60 }}>
          <Eyebrow color={colors.green}>Messages</Eyebrow>
          <T style={{ fontSize: isSm ? 28 : 36, fontWeight: '800', letterSpacing: -1.5, marginTop: 10, marginBottom: 22 }}>
            Your conversations
          </T>

          {authLoading || loading ? (
            <ActivityIndicator color={colors.green} />
          ) : !user ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, gap: 14, alignItems: 'flex-start' }}>
              <T style={{ lineHeight: 24 }}>Sign in to message equipment owners and renters.</T>
              <Button label="Sign in →" onPress={() => router.push('/auth')} />
            </View>
          ) : rows.length === 0 ? (
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, gap: 14, alignItems: 'flex-start' }}>
              <T style={{ lineHeight: 24 }}>
                No conversations yet. Open any listing and tap “Message owner” to start one.
              </T>
              <Button label="Browse equipment →" onPress={() => router.push('/')} />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {rows.map((c) => {
                const otherId = c.renter_id === user.id ? c.owner_id : c.renter_id;
                const other = profiles[otherId];
                const unread = counts[c.id] ?? 0;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/chat/${c.id}`)}
                    style={((s: any) => [
                      {
                        backgroundColor: '#fff',
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: s.hovered ? colors.green : colors.line,
                        padding: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                      },
                      web({ cursor: 'pointer', transition: 'border-color .15s' }),
                    ]) as any}
                  >
                    <Avatar url={other?.avatar_url} name={other?.full_name} size={48} />
                    <View style={{ flex: 1 }}>
                      <T style={{ fontWeight: '800', fontSize: 15 }}>{other?.full_name || 'AgroGear user'}</T>
                      <T style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {c.equipment ? `${c.equipment.emoji} ${c.equipment.name}` : 'Listing removed'}
                      </T>
                      <T numberOfLines={1} style={{ fontSize: 13, marginTop: 5, color: unread ? colors.ink : colors.navText, fontWeight: unread ? '800' : '400' }}>
                        {c.last_message || 'No messages yet'}
                      </T>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <T style={{ color: colors.muted, fontSize: 11 }}>{timeAgo(c.last_message_at)}</T>
                      {unread ? (
                        <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                          <T style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{unread}</T>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
        <Footer />
      </ScrollView>
    </View>
  );
}
