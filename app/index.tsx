import React, { useEffect, useMemo, useRef, useState } from 'react';
import MapView from '@/components/MapView';
import type { MapMarker } from '@/lib/mapTypes';
import { money } from '@/lib/format';
import { ActivityIndicator, LayoutChangeEvent, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EquipmentCard } from '@/components/EquipmentCard';
import { EquipmentModal } from '@/components/EquipmentModal';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { ListingForm } from '@/components/ListingForm';
import { useToast } from '@/components/Toast';
import { Button, Chip, DateField, Field, SelectField, T, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useMarket } from '@/context/MarketContext';
import { ALL_CATEGORIES, CATEGORIES, CONDITIONS, Equipment, NIGERIA_STATES } from '@/lib/data';
import { DEFAULT_FILTERS, Filters, Sort, activeFilterCount, filterEquipment } from '@/lib/search';
import { todayISO } from '@/lib/format';
import { colors, useBreakpoint } from '@/lib/theme';
import { Pressable, TextInput } from 'react-native';
import { fontFamily, web } from '@/lib/theme';

const CATEGORY_NAMES = [ALL_CATEGORIES, ...CATEGORIES];
const GAP = 19;

export default function Home() {
  const { isSm, isMd, columns, width } = useBreakpoint();
  const { user } = useAuth();
  const { equipment, loading, offline, favourites, bookedRanges, toggleFavourite } = useMarket();
  const params = useLocalSearchParams<{ list?: string }>();
  const toast = useToast();
  const router = useRouter();

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));
  const { category, query, sort } = filters;
  const [showingFavourites, setShowingFavourites] = useState(false);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [view, setView] = useState<'grid' | 'map'>('grid');

  const scroller = useRef<any>(null);
  const offsets = useRef<Record<string, number>>({});
  const scrollTo = (key: string) => scroller.current?.scrollTo({ y: Math.max(0, offsets.current[key] ?? 0), animated: true });
  const track = (key: string) => (e: LayoutChangeEvent) => {
    offsets.current[key] = e.nativeEvent.layout.y;
  };

  const items = useMemo(
    () => filterEquipment(equipment, filters, bookedRanges, showingFavourites ? favourites : undefined),
    [equipment, filters, bookedRanges, showingFavourites, favourites],
  );
  const filterCount = activeFilterCount(filters);

  useEffect(() => {
    if (params.list) setTimeout(() => scrollTo('list'), 400);
  }, [params.list]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setShowingFavourites(false);
  };

  const onFavourites = () => {
    if (!user) {
      toast('Sign in to save and view your favourites.');
      router.push('/auth');
      return;
    }
    setShowingFavourites((s) => !s);
    setFilters(DEFAULT_FILTERS);
    scrollTo('marketplace');
  };

  const onHeart = async (id: number) => {
    if (!user) {
      toast('Sign in to save favourites.');
      router.push('/auth');
      return;
    }
    const had = favourites.has(id);
    const res = await toggleFavourite(id);
    toast(res.error ?? (had ? 'Removed from favourites.' : 'Added to favourites.'));
  };

  const mapMarkers = useMemo<MapMarker[]>(
    () =>
      items
        .filter((e) => e.latitude != null && e.longitude != null)
        .map((e) => ({
          id: `eq-${e.id}`,
          lat: e.latitude as number,
          lng: e.longitude as number,
          emoji: e.emoji,
          color: e.color,
          label: `${e.name} · ${money(e.price)}/day · ${e.location}`,
          onPress: () => setSelected(e),
        })),
    [items],
  );

  const cardWidth =
    gridWidth > 0 ? Math.floor((gridWidth - GAP * (columns - 1)) / columns) : `${100 / columns - 2}%`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header
        favouriteCount={favourites.size}
        showingFavourites={showingFavourites}
        onMarketplace={() => {
          setShowingFavourites(false);
          scrollTo('marketplace');
        }}
        onFavourites={onFavourites}
        onList={() => scrollTo('list')}
      />

      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <View
          style={{
            width: '100%',
            maxWidth: 1240,
            alignSelf: 'center',
            paddingTop: isSm ? 20 : 34,
            paddingBottom: isSm ? 45 : 70,
            paddingHorizontal: isSm ? 14 : 28,
          }}
        >
          <Hero onExplore={() => scrollTo('marketplace')} onList={() => scrollTo('list')} />

          <View style={{ flexDirection: 'row', gap: isSm ? 8 : 14, marginTop: 22, marginBottom: 38 }}>
            <Stat value={String(equipment.length)} label="Equipment listings" />
            <Stat value="36 states" label="Built for nationwide discovery" />
            <Stat value="One platform" label="Owners and farmers together" />
          </View>

          <View onLayout={track('marketplace')}>
            <SectionHead title="Find your next machine" subtitle="Explore equipment for every stage of your farm." />

            <View
              style={{
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 16,
                padding: 12,
                flexDirection: isSm ? 'column' : 'row',
                alignItems: isSm ? 'stretch' : 'center',
                gap: 12,
                marginTop: 22,
                marginBottom: 16,
              }}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <T style={{ fontSize: 16, color: colors.muted }}>⌕</T>
                <TextInput
                  value={query}
                  onChangeText={(v) => patch({ query: v })}
                  placeholder="Search tractors, harvesters, locations..."
                  placeholderTextColor="#9aa59c"
                  style={[
                    { flex: 1, minWidth: 80, padding: 8, fontSize: 14, color: colors.ink, fontFamily },
                    web({ outlineStyle: 'none' }),
                  ]}
                />
              </View>
              <View
                style={
                  isSm
                    ? { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }
                    : { borderLeftWidth: 1, borderLeftColor: colors.line, paddingLeft: 8, maxWidth: 190 }
                }
              >
                <SelectField
                  value={sort}
                  onChange={(v) => patch({ sort: v as Sort })}
                  style={{ border: 'none', padding: 8, background: '#fff' }}
                  options={[
                    { value: 'featured', label: 'Featured first' },
                    { value: 'newest', label: 'Newest' },
                    { value: 'rating', label: 'Top rated' },
                    { value: 'low', label: 'Price: low to high' },
                    { value: 'high', label: 'Price: high to low' },
                  ]}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 17, marginBottom: 23 }}>
              {CATEGORY_NAMES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={category === c}
                  onPress={() => {
                    patch({ category: c });
                    setShowingFavourites(false);
                  }}
                />
              ))}
              <Chip label={`⚙ Filters${filterCount ? ` (${filterCount})` : ''}`} active={showFilters} onPress={() => setShowFilters((v) => !v)} />
            </View>

            {showFilters ? (
              <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: isSm ? 14 : 20, marginBottom: 22, gap: 16 }}>
                <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 14 }}>
                  <Field label="State" style={{ flex: 1 }}>
                    <SelectField value={filters.state} onChange={(v) => patch({ state: v })} placeholder="Anywhere in Nigeria" options={NIGERIA_STATES.map((s) => ({ value: s, label: s }))} />
                  </Field>
                  <Field label="Min price / day (₦)" style={{ flex: 1 }}>
                    <TextField value={filters.minPrice} onChangeText={(v) => patch({ minPrice: v.replace(/[^0-9]/g, '') })} keyboardType="numeric" placeholder="0" />
                  </Field>
                  <Field label="Max price / day (₦)" style={{ flex: 1 }}>
                    <TextField value={filters.maxPrice} onChangeText={(v) => patch({ maxPrice: v.replace(/[^0-9]/g, '') })} keyboardType="numeric" placeholder="Any" />
                  </Field>
                </View>
                <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 14 }}>
                  <Field label="Available from" style={{ flex: 1 }}>
                    <DateField value={filters.from} min={todayISO()} onChange={(v) => patch({ from: v, to: filters.to && filters.to < v ? v : filters.to })} />
                  </Field>
                  <Field label="Available until" style={{ flex: 1 }}>
                    <DateField value={filters.to} min={filters.from || todayISO()} onChange={(v) => patch({ to: v })} />
                  </Field>
                  <Field label="Condition" style={{ flex: 1 }}>
                    <SelectField value={filters.condition} onChange={(v) => patch({ condition: v })} placeholder="Any condition" options={CONDITIONS.map((c) => ({ value: c, label: c }))} />
                  </Field>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
                  <Chip label="✓ Verified owners" active={filters.verifiedOnly} onPress={() => patch({ verifiedOnly: !filters.verifiedOnly })} />
                  <Chip label="Delivery available" active={filters.deliveryOnly} onPress={() => patch({ deliveryOnly: !filters.deliveryOnly })} />
                  <Chip label="Operator included" active={filters.operatorOnly} onPress={() => patch({ operatorOnly: !filters.operatorOnly })} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T style={{ color: colors.muted, fontSize: 13 }}>{items.length} machine{items.length === 1 ? '' : 's'} match</T>
                  <Pressable onPress={resetFilters} style={web({ cursor: 'pointer' })}>
                    <T style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>Clear all</T>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <SectionHead
              title={showingFavourites ? 'Your favourites' : 'Popular equipment'}
              subtitle={
                showingFavourites
                  ? 'Machines you have saved.'
                  : `${items.length} machine${items.length === 1 ? '' : 's'} · prices per day, owner approval required`
              }
              action={<Button variant="secondary" label="Reset filters" onPress={resetFilters} />}
            />

            {offline ? (
              <T style={{ fontSize: 12, color: colors.muted, marginBottom: 14 }}>
                Showing sample listings — live listings could not be loaded right now.
              </T>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 9, marginBottom: 16 }}>
              <Chip label="▦ Grid" active={view === 'grid'} onPress={() => setView('grid')} />
              <Chip label="🗺 Map" active={view === 'map'} onPress={() => setView('map')} />
            </View>

            {view === 'map' ? (
              <View style={{ marginBottom: 8 }}>
                <MapView markers={mapMarkers} height={isSm ? 380 : 480} fitKey={`${items.length}|${mapMarkers.length}`} />
                <T style={{ fontSize: 12, color: colors.muted, marginTop: 10 }}>
                  {mapMarkers.length
                    ? `Showing ${mapMarkers.length} machine${mapMarkers.length === 1 ? '' : 's'} with a pinned location. Tap a pin for details.`
                    : 'None of these machines have a pinned location yet. Owners can pin a location when listing.'}
                </T>
              </View>
            ) : null}

            <View
              onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: 6, display: view === 'map' ? 'none' : 'flex' }}
            >
              {loading ? (
                <View style={{ width: '100%', padding: 45, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.green} />
                </View>
              ) : items.length === 0 ? (
                <View
                  style={{
                    width: '100%',
                    backgroundColor: '#fff',
                    borderRadius: 18,
                    paddingVertical: 45,
                    paddingHorizontal: 20,
                    alignItems: 'center',
                  }}
                >
                  <T style={{ color: colors.muted, textAlign: 'center' }}>
                    No equipment found. Try another search or reset your filters.
                  </T>
                </View>
              ) : (
                items.map((item) => (
                  <EquipmentCard
                    key={item.id}
                    item={item}
                    width={cardWidth}
                    saved={favourites.has(item.id)}
                    onToggleFavourite={() => onHeart(item.id)}
                    onOpen={() => setSelected(item)}
                  />
                ))
              )}
            </View>
          </View>

          <View onLayout={track('list')}>
            <ListingForm onPublished={() => scrollTo('marketplace')} />
          </View>
        </View>

        <Footer />
      </ScrollView>

      <EquipmentModal item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { isSm } = useBreakpoint();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 18,
        paddingVertical: isSm ? 13 : 18,
        paddingHorizontal: isSm ? 10 : 22,
      }}
    >
      <T style={{ fontSize: isSm ? 18 : 24, fontWeight: '800', color: colors.green }}>{value}</T>
      <T style={{ fontSize: isSm ? 10 : 12, color: colors.muted, marginTop: 5 }}>{label}</T>
    </View>
  );
}

function SectionHead({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  const { isSm } = useBreakpoint();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 15, marginTop: 35, marginBottom: 20, flexWrap: 'wrap' }}>
      <View style={{ flexShrink: 1 }}>
        <T style={{ fontSize: isSm ? 23 : 28, fontWeight: '800', letterSpacing: -1 }}>{title}</T>
        <T style={{ marginTop: 7, color: colors.muted, fontSize: 14 }}>{subtitle}</T>
      </View>
      {action}
    </View>
  );
}
