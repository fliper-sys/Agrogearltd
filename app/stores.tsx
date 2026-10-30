import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import MapView from '@/components/MapView';
import { useToast } from '@/components/Toast';
import { Button, ErrorText, Eyebrow, Field, Notice, T, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useMarket } from '@/context/MarketContext';
import { Coords, formatKm, getPosition, haversineKm } from '@/lib/geo';
import type { MapMarker } from '@/lib/mapTypes';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { colors, useBreakpoint, web } from '@/lib/theme';
import type { Store } from '@/lib/types';

export default function StoresScreen() {
  const { isSm, isMd } = useBreakpoint();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { equipment } = useMarket();

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<number | null>(null);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState<Coords | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
    setStores((data as Store[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const locate = async () => {
    setError(null);
    setLocating(true);
    try {
      const c = await getPosition();
      setMe({ lat: c.latitude, lng: c.longitude });
    } catch (e: any) {
      setError(e?.message ?? 'Could not get your location.');
    }
    setLocating(false);
  };

  const ranked = useMemo(() => {
    const list = stores.map((s) => ({
      store: s,
      km: me ? haversineKm(me, { lat: s.latitude, lng: s.longitude }) : null,
    }));
    if (me) list.sort((a, b) => (a.km as number) - (b.km as number));
    return list;
  }, [stores, me]);

  const nearbyEquipment = useMemo(() => {
    if (!me) return [];
    return equipment
      .filter((e) => e.latitude != null && e.longitude != null)
      .map((e) => ({ e, km: haversineKm(me, { lat: e.latitude as number, lng: e.longitude as number }) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 4);
  }, [equipment, me]);

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = ranked.map(({ store, km }) => ({
      id: `store-${store.id}`,
      lat: store.latitude,
      lng: store.longitude,
      emoji: '🏪',
      color: store.verified ? colors.mint : '#fff',
      label: `${store.name}${km != null ? ` · ${formatKm(km)} away` : ''}${store.verified ? ' · verified' : ''}`,
      onPress: () => setFocus(store.id),
    }));
    equipment
      .filter((e) => e.latitude != null && e.longitude != null)
      .forEach((e) =>
        m.push({ id: `eq-${e.id}`, lat: e.latitude as number, lng: e.longitude as number, emoji: e.emoji, color: e.color, label: `${e.name} · ${e.location}` }),
      );
    if (me) m.push({ id: 'me', lat: me.lat, lng: me.lng, emoji: '📍', color: colors.coral, label: 'You are here' });
    if (pin) m.push({ id: 'pin', lat: pin.lat, lng: pin.lng, emoji: '➕', color: colors.mint, label: 'New store location' });
    return m;
  }, [ranked, equipment, me, pin]);

  const pinMyLocation = async () => {
    setFormError(null);
    try {
      const c = await getPosition();
      setPin({ lat: c.latitude, lng: c.longitude });
    } catch (e: any) {
      setFormError(e?.message ?? 'Could not get your location.');
    }
  };

  const submit = async () => {
    setFormError(null);
    if (!user) {
      toast('Sign in to add an Agro store.');
      return router.push('/auth');
    }
    if (name.trim().length < 2) return setFormError('Enter the store name.');
    if (!pin) return setFormError('Tap the map (or use your current location) to place the store.');
    setSaving(true);
    const { error: err } = await supabase.from('stores').insert({
      created_by: user.id,
      name: name.trim(),
      address: address.trim() || null,
      city: city.trim() || null,
      phone: phone.trim() || null,
      latitude: pin.lat,
      longitude: pin.lng,
    });
    setSaving(false);
    if (err) return setFormError(err.message);
    toast('Store added. An admin will verify it soon.');
    setName('');
    setAddress('');
    setCity('');
    setPhone('');
    setPin(null);
    setAdding(false);
    load();
  };

  const nearest = me && ranked.length ? ranked[0] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header active="stores" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ width: '100%', maxWidth: 1240, alignSelf: 'center', padding: isSm ? 14 : 28, paddingBottom: 60 }}>
          <Eyebrow color={colors.green}>Agro stores</Eyebrow>
          <T style={{ fontSize: isSm ? 28 : 36, fontWeight: '800', letterSpacing: -1.5, marginTop: 10 }}>
            Find your nearest Agro store.
          </T>
          <T style={{ color: colors.muted, lineHeight: 24, marginTop: 8, maxWidth: 620 }}>
            Stores for inputs, parts and farm supplies, added by the AgroGear community. Share your location to see what is closest.
          </T>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
            <Button label={me ? '📍 Refresh my location' : '📍 Find stores near me'} onPress={locate} loading={locating} />
            <Button variant="secondary" label={adding ? 'Cancel' : '＋ Add a store'} onPress={() => setAdding((a) => !a)} />
          </View>
          <ErrorText>{error}</ErrorText>

          {nearest ? (
            <View
              style={{
                marginTop: 20,
                backgroundColor: colors.green,
                borderRadius: 20,
                padding: 22,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <T style={{ fontSize: 44, color: '#fff' }}>🏪</T>
              <View style={{ flex: 1 }}>
                <Eyebrow>Closest to you</Eyebrow>
                <T style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 }}>{nearest.store.name}</T>
                <T style={{ color: colors.heroText, fontSize: 13, marginTop: 4 }}>
                  {formatKm(nearest.km as number)} away{nearest.store.city ? ` · ${nearest.store.city}` : ''}
                </T>
              </View>
            </View>
          ) : null}

          {adding ? (
            <View style={{ marginTop: 20, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: isSm ? 18 : 24 }}>
              <T style={{ fontSize: 18, fontWeight: '800' }}>Add an Agro store</T>
              <View style={{ gap: 16, marginTop: 16 }}>
                <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 16 }}>
                  <Field label="Store name *" style={{ flex: 1 }}>
                    <TextField value={name} onChangeText={setName} placeholder="e.g. Jos Agro Supplies" />
                  </Field>
                  <Field label="Phone" style={{ flex: 1 }}>
                    <TextField value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
                  </Field>
                </View>
                <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 16 }}>
                  <Field label="Address" style={{ flex: 1 }}>
                    <TextField value={address} onChangeText={setAddress} placeholder="Street / landmark" />
                  </Field>
                  <Field label="City" style={{ flex: 1 }}>
                    <TextField value={city} onChangeText={setCity} placeholder="e.g. Jos" />
                  </Field>
                </View>
                <Field label="Location *">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <Button variant="secondary" label="📍 Use my current location" onPress={pinMyLocation} />
                    <T style={{ fontSize: 12, color: pin ? colors.available : colors.muted, fontWeight: pin ? '700' : '400' }}>
                      {pin ? `Placed ✓ (${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)})` : 'or tap the map below to drop a pin'}
                    </T>
                  </View>
                </Field>
              </View>
              <ErrorText>{formError}</ErrorText>
              <Button label="Submit store →" onPress={submit} loading={saving} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
              <Notice>New stores show as unverified until an admin checks them.</Notice>
            </View>
          ) : null}

          <View style={{ flexDirection: isMd ? 'column' : 'row', gap: 20, marginTop: 24 }}>
            <View style={{ flex: isMd ? undefined : 1.4 }}>
              <MapView
                markers={markers}
                height={isSm ? 360 : 520}
                fitKey={`${stores.length}|${me ? 'me' : ''}`}
                onMapPress={adding ? (c) => setPin(c) : undefined}
              />
              <T style={{ fontSize: 12, color: colors.muted, marginTop: 10 }}>
                🏪 stores · 🚜 equipment {me ? '· 📍 you' : ''}
                {adding ? ' · tap the map to place your store' : ''}
              </T>
            </View>

            <View style={{ flex: isMd ? undefined : 1, gap: 12 }}>
              {loading ? (
                <ActivityIndicator color={colors.green} />
              ) : ranked.length === 0 ? (
                <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 28 }}>
                  <T style={{ color: colors.muted, textAlign: 'center' }}>
                    No Agro stores yet. Be the first to add one near you.
                  </T>
                </View>
              ) : (
                ranked.map(({ store, km }, i) => (
                  <Pressable
                    key={store.id}
                    onPress={() => setFocus(store.id)}
                    style={[
                      {
                        backgroundColor: '#fff',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: focus === store.id ? colors.green : colors.line,
                        padding: 16,
                        flexDirection: 'row',
                        gap: 12,
                        alignItems: 'center',
                      },
                      web({ cursor: 'pointer' }),
                    ]}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: store.verified ? colors.mint : colors.imageBg, alignItems: 'center', justifyContent: 'center' }}>
                      <T style={{ fontSize: 24 }}>🏪</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T style={{ fontWeight: '800', fontSize: 15 }}>
                        {me && i === 0 ? '⭐ ' : ''}
                        {store.name}
                      </T>
                      <T style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                        {[store.address, store.city].filter(Boolean).join(', ') || 'Location pinned on map'}
                      </T>
                      <T style={{ fontSize: 11, marginTop: 4, color: store.verified ? colors.available : colors.muted, fontWeight: '700' }}>
                        {store.verified ? '✓ Verified' : 'Unverified'}
                        {store.phone ? `  ·  ${store.phone}` : ''}
                      </T>
                    </View>
                    {km != null ? <T style={{ fontWeight: '800', color: colors.green }}>{formatKm(km)}</T> : null}
                  </Pressable>
                ))
              )}

              {nearbyEquipment.length ? (
                <View style={{ marginTop: 12 }}>
                  <T style={{ fontWeight: '800', fontSize: 15, marginBottom: 10 }}>Equipment near you</T>
                  {nearbyEquipment.map(({ e, km }) => (
                    <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                      <T style={{ fontSize: 24 }}>{e.emoji}</T>
                      <T style={{ flex: 1, fontSize: 14 }}>{e.name}</T>
                      <T style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>{formatKm(km)}</T>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <Footer />
      </ScrollView>
    </View>
  );
}
