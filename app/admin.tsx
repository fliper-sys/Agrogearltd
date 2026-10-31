import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdminBookings, AdminListings, AdminStores, AdminUsers, AdminVerification } from '@/components/admin/Panels';
import { Header } from '@/components/Header';
import { Button, Chip, Eyebrow, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { money } from '@/lib/format';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { colors, useBreakpoint } from '@/lib/theme';

type Tab = 'overview' | 'verification' | 'users' | 'listings' | 'bookings' | 'stores';

type Stats = {
  users: number; suspended: number; pending_verifications: number; listings: number; hidden_listings: number;
  bookings: number; open_bookings: number; disputes: number; gmv: number; stores: number; unverified_stores: number;
  conversations: number;
};

export default function AdminScreen() {
  const { isSm } = useBreakpoint();
  const router = useRouter();
  const { user, loading, profile } = useAuth();
  const isAdmin = Boolean(profile?.isAdmin);
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('admin_stats');
    if (error) setStatsError(error.message);
    else setStats(data as Stats);
  }, []);

  useEffect(() => {
    if (isAdmin) loadStats();
  }, [isAdmin, loadStats, tab]);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'verification', label: `🪪 Verification${stats?.pending_verifications ? ` (${stats.pending_verifications})` : ''}` },
    { key: 'users', label: '👥 Users' },
    { key: 'listings', label: '🚜 Listings' },
    { key: 'bookings', label: '📅 Bookings' },
    { key: 'stores', label: '🏪 Stores' },
  ];

  const tiles = useMemo(
    () =>
      stats
        ? [
            { emoji: '👥', label: 'Users', value: String(stats.users), note: `${stats.suspended} restricted` },
            { emoji: '🪪', label: 'Awaiting ID review', value: String(stats.pending_verifications), note: 'Verification queue' },
            { emoji: '🚜', label: 'Listings', value: String(stats.listings), note: `${stats.hidden_listings} hidden` },
            { emoji: '📅', label: 'Bookings', value: String(stats.bookings), note: `${stats.open_bookings} in progress` },
            { emoji: '⚠️', label: 'Disputes', value: String(stats.disputes), note: 'Need attention' },
            { emoji: '💰', label: 'Booked value', value: money(stats.gmv), note: 'Paid or completed bookings' },
            { emoji: '🏪', label: 'Agro stores', value: String(stats.stores), note: `${stats.unverified_stores} unverified` },
            { emoji: '💬', label: 'Conversations', value: String(stats.conversations), note: 'Message contents are private' },
          ]
        : [],
    [stats],
  );

  if (loading || (user && !profile)) {
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
            {tabs.map((t) => (
              <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
            ))}
          </View>

          {tab === 'overview' ? (
            stats ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {tiles.map((t) => (
                  <View
                    key={t.label}
                    style={{ flexGrow: 1, flexBasis: isSm ? '45%' : 200, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 20 }}
                  >
                    <T style={{ fontSize: 28 }}>{t.emoji}</T>
                    <T style={{ fontSize: 28, fontWeight: '800', color: colors.green, marginTop: 6 }}>{t.value}</T>
                    <T style={{ fontWeight: '700', marginTop: 2 }}>{t.label}</T>
                    <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{t.note}</T>
                  </View>
                ))}
              </View>
            ) : statsError ? (
              <T style={{ color: colors.error }}>{statsError} — did you run supabase/migrations/003_merge_features.sql?</T>
            ) : (
              <ActivityIndicator color={colors.green} />
            )
          ) : null}
          {tab === 'verification' ? <AdminVerification onChange={loadStats} /> : null}
          {tab === 'users' ? <AdminUsers /> : null}
          {tab === 'listings' ? <AdminListings /> : null}
          {tab === 'bookings' ? <AdminBookings /> : null}
          {tab === 'stores' ? <AdminStores /> : null}
        </View>
      </ScrollView>
    </View>
  );
}
