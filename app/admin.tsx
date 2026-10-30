import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminBookings, AdminListings, AdminStores, AdminUsers } from '@/components/admin/Panels';
import { Header } from '@/components/Header';
import { Button, Chip, Eyebrow, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { colors, useBreakpoint } from '@/lib/theme';

type Tab = 'overview' | 'users' | 'listings' | 'bookings' | 'stores';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: '📊 Overview' },
  { key: 'users', label: '👥 Users' },
  { key: 'listings', label: '🚜 Listings' },
  { key: 'bookings', label: '📅 Bookings' },
  { key: 'stores', label: '🏪 Stores' },
];

async function count(table: string, filter?: (q: any) => any) {
  let q: any = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: c } = await q;
  return c ?? 0;
}

export default function AdminScreen() {
  const { isSm } = useBreakpoint();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: profileLoading, profile } = useProfile();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  const loadStats = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const [users, admins, suspended, listings, hidden, bookings, pending, stores, unverified, chats] = await Promise.all([
      count('profiles'),
      count('profiles', (q) => q.eq('role', 'admin')),
      count('profiles', (q) => q.eq('status', 'suspended')),
      count('equipment'),
      count('equipment', (q) => q.eq('hidden', true)),
      count('bookings'),
      count('bookings', (q) => q.eq('status', 'pending')),
      count('stores'),
      count('stores', (q) => q.eq('verified', false)),
      count('conversations'),
    ]);
    setStats({ users, admins, suspended, listings, hidden, bookings, pending, stores, unverified, chats });
  }, []);

  useEffect(() => {
    if (isAdmin) loadStats();
  }, [isAdmin, loadStats, tab]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = useMemo(
    () =>
      stats
        ? [
            { emoji: '👥', label: 'Users', value: stats.users, note: `${stats.admins} admin · ${stats.suspended} restricted` },
            { emoji: '🚜', label: 'Listings', value: stats.listings, note: `${stats.hidden} hidden` },
            { emoji: '📅', label: 'Booking requests', value: stats.bookings, note: `${stats.pending} pending` },
            { emoji: '🏪', label: 'Agro stores', value: stats.stores, note: `${stats.unverified} unverified` },
            { emoji: '💬', label: 'Conversations', value: stats.chats, note: 'Message contents are private' },
          ]
        : [],
    [stats],
  );

  if (authLoading || profileLoading || (user && !profile)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <Header active="admin" />
        <ActivityIndicator color={colors.green} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <Header active="admin" />
        <View style={{ padding: 28, alignItems: 'flex-start', gap: 14, maxWidth: 560, alignSelf: 'center', width: '100%' }}>
          <T style={{ fontSize: 28, fontWeight: '800', letterSpacing: -1 }}>Admins only</T>
          <T style={{ color: colors.muted, lineHeight: 24 }}>You do not have access to the admin dashboard.</T>
          <Button label="Back to marketplace" onPress={() => router.replace('/')} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header active="admin" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center', padding: isSm ? 14 : 28, paddingBottom: 70 }}>
          <Eyebrow color={colors.green}>Admin</Eyebrow>
          <T style={{ fontSize: isSm ? 28 : 36, fontWeight: '800', letterSpacing: -1.5, marginTop: 10 }}>Dashboard</T>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginVertical: 22 }}>
            {TABS.map((t) => (
              <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
            ))}
          </View>

          {tab === 'overview' ? (
            stats ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {tiles.map((t) => (
                  <View
                    key={t.label}
                    style={{
                      flexGrow: 1,
                      flexBasis: isSm ? '45%' : 200,
                      backgroundColor: '#fff',
                      borderWidth: 1,
                      borderColor: colors.line,
                      borderRadius: 18,
                      padding: 20,
                    }}
                  >
                    <T style={{ fontSize: 28 }}>{t.emoji}</T>
                    <T style={{ fontSize: 30, fontWeight: '800', color: colors.green, marginTop: 6 }}>{t.value}</T>
                    <T style={{ fontWeight: '700', marginTop: 2 }}>{t.label}</T>
                    <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{t.note}</T>
                  </View>
                ))}
              </View>
            ) : (
              <ActivityIndicator color={colors.green} />
            )
          ) : null}
          {tab === 'users' ? <AdminUsers /> : null}
          {tab === 'listings' ? <AdminListings /> : null}
          {tab === 'bookings' ? <AdminBookings /> : null}
          {tab === 'stores' ? <AdminStores /> : null}
        </View>
      </ScrollView>
    </View>
  );
}
