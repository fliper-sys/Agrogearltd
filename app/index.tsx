import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EquipmentCard } from '@/components/EquipmentCard';
import { EquipmentModal } from '@/components/EquipmentModal';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { ListingForm } from '@/components/ListingForm';
import { useToast } from '@/components/Toast';
import { Button, Chip, SelectField, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useMarket } from '@/context/MarketContext';
import { ALL_CATEGORIES, CATEGORIES, Equipment } from '@/lib/data';
import { colors, useBreakpoint } from '@/lib/theme';
import { TextInput } from 'react-native';
import { fontFamily, web } from '@/lib/theme';

const CATEGORY_NAMES = [ALL_CATEGORIES, ...CATEGORIES];
const GAP = 19;

export default function Home() {
  const { isSm, isMd, columns, width } = useBreakpoint();
  const { user } = useAuth();
  const { equipment, loading, offline, favourites, toggleFavourite } = useMarket();
  const toast = useToast();
  const router = useRouter();

  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [showingFavourites, setShowingFavourites] = useState(false);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

  const scroller = useRef<any>(null);
  const offsets = useRef<Record<string, number>>({});
  const scrollTo = (key: string) => scroller.current?.scrollTo({ y: Math.max(0, offsets.current[key] ?? 0), animated: true });
  const track = (key: string) => (e: LayoutChangeEvent) => {
    offsets.current[key] = e.nativeEvent.layout.y;
  };

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = equipment.filter(
      (e) =>
        (category === ALL_CATEGORIES || e.category === category) &&
        (!showingFavourites || favourites.has(e.id)) &&
        [e.name, e.category, e.location, e.description].join(' ').toLowerCase().includes(q),
    );
    if (sort === 'low') list.sort((a, b) => a.price - b.price);
    else if (sort === 'high') list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => Number(b.featured) - Number(a.featured) || a.id - b.id);
    return list;
  }, [equipment, category, query, sort, showingFavourites, favourites]);

  const resetFilters = () => {
    setCategory(ALL_CATEGORIES);
    setShowingFavourites(false);
    setQuery('');
    setSort('featured');
  };

  const onFavourites = () => {
    if (!user) {
      toast('Sign in to save and view your favourites.');
      router.push('/auth');
      return;
    }
    setShowingFavourites((s) => !s);
    setQuery('');
    setCategory(ALL_CATEGORIES);
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
                  onChangeText={setQuery}
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
                  onChange={setSort}
                  style={{ border: 'none', padding: 8, background: '#fff' }}
                  options={[
                    { value: 'featured', label: 'Featured first' },
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
                    setCategory(c);
                    setShowingFavourites(false);
                  }}
                />
              ))}
            </View>

            <SectionHead
              title={showingFavourites ? 'Your favourites' : 'Popular equipment'}
              subtitle={
                showingFavourites
                  ? 'Machines you have saved.'
                  : 'Rental prices are indicative; contact the owner to confirm availability.'
              }
              action={<Button variant="secondary" label="Reset filters" onPress={resetFilters} />}
            />

            {offline ? (
              <T style={{ fontSize: 12, color: colors.muted, marginBottom: 14 }}>
                Showing sample listings — live listings could not be loaded right now.
              </T>
            ) : null}

            <View
              onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginTop: 6 }}
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
