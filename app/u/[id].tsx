import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { VerifiedBadge } from '@/components/Badges';
import { EquipmentCard } from '@/components/EquipmentCard';
import { EquipmentModal } from '@/components/EquipmentModal';
import { Card, PageShell } from '@/components/PageShell';
import { ReviewList, StarRow } from '@/components/Reviews';
import { T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { Equipment } from '@/lib/data';
import { useMarket } from '@/context/MarketContext';
import { formatDate } from '@/lib/time';
import { useProfileStats, useRenterReviews } from '@/lib/reviews';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { colors, useBreakpoint, web } from '@/lib/theme';
import { timeAgo } from '@/lib/geo';

type Pub = {
  id: string;
  full_name: string;
  state: string | null;
  farm_name: string | null;
  bio: string | null;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
  avatar_url: string | null;
};

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 130, backgroundColor: colors.cream, borderRadius: 14, padding: 14 }}>
      <T style={{ fontSize: 24, fontWeight: '800', color: colors.green }}>{value}</T>
      <T style={{ fontWeight: '700', fontSize: 13, marginTop: 2 }}>{label}</T>
      {note ? <T style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{note}</T> : null}
    </View>
  );
}

/** Public profile: identity, trust signals, listings and reviews. No private data (phone, address, ID) is shown. */
export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isSm } = useBreakpoint();
  const { user } = useAuth();
  const { equipment, favourites, toggleFavourite } = useMarket();
  const [p, setP] = useState<Pub | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Equipment | null>(null);
  const stats = useProfileStats(id);
  const renterReviews = useRenterReviews(id);

  useEffect(() => {
    if (!id || !isSupabaseConfigured) return setLoading(false);
    supabase.from('public_profiles').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      setP((data as Pub) ?? null);
      setLoading(false);
    });
  }, [id]);

  const listings = useMemo(() => equipment.filter((e) => e.ownerId === id), [equipment, id]);
  const mine = user?.id === id;

  if (loading) {
    return <PageShell title="Profile"><ActivityIndicator color={colors.green} style={{ marginTop: 30 }} /></PageShell>;
  }
  if (!p) {
    return (
      <PageShell title="Profile not found">
        <Card><T style={{ color: colors.muted }}>This user could not be found.</T></Card>
      </PageShell>
    );
  }

  return (
    <PageShell title={p.full_name || 'AgroGear user'} subtitle={[p.farm_name, p.state].filter(Boolean).join(' · ') || undefined}>
      <Card>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar url={p.avatar_url} name={p.full_name} size={isSm ? 72 : 92} />
          <View style={{ flex: 1, minWidth: 200, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {p.is_verified ? <VerifiedBadge /> : <T style={{ color: colors.muted, fontSize: 12 }}>ID not verified yet</T>}
              {mine ? (
                <Pressable onPress={() => router.push('/profile')} style={web({ cursor: 'pointer' })}>
                  <T style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>Edit your profile →</T>
                </Pressable>
              ) : null}
            </View>
            <T style={{ color: colors.muted, fontSize: 13 }}>
              Member since {formatDate(p.created_at)}
              {p.verified_at ? ` · verified ${timeAgo(p.verified_at)}` : ''}
            </T>
            {p.bio ? <T style={{ lineHeight: 22 }}>{p.bio}</T> : null}
          </View>
        </View>
        {stats ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
            <Stat
              value={stats.owner_reviews ? `★ ${Number(stats.owner_rating).toFixed(1)}` : '—'}
              label="Owner rating"
              note={`${stats.owner_reviews} review${stats.owner_reviews === 1 ? '' : 's'}`}
            />
            <Stat value={String(stats.listings)} label="Active listings" />
            <Stat value={String(stats.completed_as_owner)} label="Machines rented out" />
            <Stat
              value={stats.renter_reviews ? `★ ${Number(stats.renter_rating).toFixed(1)}` : '—'}
              label="Renter rating"
              note={`${stats.completed_as_renter} rental${stats.completed_as_renter === 1 ? '' : 's'} completed`}
            />
          </View>
        ) : null}
      </Card>

      <Card>
        <T style={{ fontSize: 18, fontWeight: '800', marginBottom: 14 }}>Equipment ({listings.length})</T>
        {listings.length === 0 ? (
          <T style={{ color: colors.muted }}>No active listings.</T>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {listings.map((item) => (
              <EquipmentCard
                key={item.id}
                item={item}
                width={isSm ? '100%' : '47%'}
                saved={favourites.has(item.id)}
                onToggleFavourite={() => toggleFavourite(item.id)}
                onOpen={() => setOpen(item)}
              />
            ))}
          </View>
        )}
      </Card>

      <Card>
        <T style={{ fontSize: 18, fontWeight: '800', marginBottom: 14 }}>Reviews from renters</T>
        <ReviewList ownerId={id} showEquipment limit={5} />
      </Card>

      {renterReviews.length ? (
        <Card>
          <T style={{ fontSize: 18, fontWeight: '800', marginBottom: 6 }}>How owners rate them as a renter</T>
          {renterReviews.map((r) => (
            <View key={r.id} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar url={r.owner_avatar} name={r.owner_name} size={30} />
                <T style={{ fontWeight: '700', flex: 1 }}>{r.owner_name}</T>
                <StarRow rating={r.rating} size={14} />
              </View>
              {r.comment ? <T style={{ lineHeight: 21, fontSize: 14 }}>{r.comment}</T> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <EquipmentModal item={open} onClose={() => setOpen(null)} />
    </PageShell>
  );
}
