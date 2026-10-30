import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useMarket } from '@/context/MarketContext';
import { CATEGORIES } from '@/lib/data';
import { getPosition } from '@/lib/geo';
import { colors, useBreakpoint } from '@/lib/theme';
import { useToast } from './Toast';
import { Button, ErrorText, Eyebrow, Field, Notice, SelectField, T, TextField } from './ui';

export function ListingForm({ onPublished }: { onPublished: () => void }) {
  const { isSm } = useBreakpoint();
  const { user } = useAuth();
  const { createListing } = useMarket();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const pinLocation = async () => {
    setError(null);
    setLocating(true);
    try {
      const c = await getPosition();
      setCoords({ lat: c.latitude, lng: c.longitude });
    } catch (e: any) {
      setError(e?.message ?? 'Could not get your location.');
    }
    setLocating(false);
  };

  const submit = async () => {
    setError(null);
    const amount = Number(price);
    if (!name.trim() || !category || !amount || amount < 1 || !location.trim()) {
      return setError('Please complete the required fields.');
    }
    if (!user) {
      toast('Please sign in to publish your equipment.');
      return router.push('/auth');
    }
    setBusy(true);
    const res = await createListing({
      name: name.trim(),
      category,
      price: amount,
      location: location.trim(),
      description: description.trim(),
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    setCoords(null);
    setName('');
    setCategory('');
    setPrice('');
    setLocation('');
    setDescription('');
    toast('Your equipment is now live on the marketplace!');
    onPublished();
  };

  const row = { flexDirection: isSm ? 'column' : 'row', gap: 16 } as const;

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 22,
        padding: isSm ? 19 : 27,
        marginTop: 42,
      }}
    >
      <Eyebrow color={colors.green}>For equipment owners</Eyebrow>
      <T style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.7, marginTop: 10, marginBottom: 8 }}>
        Put your machinery to work.
      </T>
      <T style={{ color: colors.muted, lineHeight: 24, marginBottom: 20 }}>
        List your equipment on AgroGear and let farmers across Nigeria find and request it.
      </T>

      <View style={{ gap: 16 }}>
        <View style={row}>
          <Field label="Equipment name *" style={{ flex: 1 }}>
            <TextField value={name} onChangeText={setName} placeholder="e.g. John Deere 5050D" />
          </Field>
          <Field label="Category *" style={{ flex: 1 }}>
            <SelectField
              value={category}
              onChange={setCategory}
              placeholder="Choose category"
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
        </View>
        <View style={row}>
          <Field label="Daily rental price (₦) *" style={{ flex: 1 }}>
            <TextField value={price} onChangeText={setPrice} placeholder="e.g. 85000" keyboardType="numeric" />
          </Field>
          <Field label="Location *" style={{ flex: 1 }}>
            <TextField value={location} onChangeText={setLocation} placeholder="e.g. Abuja, FCT" />
          </Field>
        </View>
        <Field label="Pin on the map (optional)">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              label={coords ? '📍 Update my location' : '📍 Use my current location'}
              onPress={pinLocation}
              loading={locating}
            />
            {coords ? (
              <T style={{ fontSize: 12, color: colors.available, fontWeight: '700' }}>
                Pinned ✓ ({coords.lat.toFixed(3)}, {coords.lng.toFixed(3)})
              </T>
            ) : (
              <T style={{ fontSize: 12, color: colors.muted }}>Helps renters find machines near them.</T>
            )}
          </View>
        </Field>
        <Field label="Description">
          <TextField
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Condition, capacity, delivery options..."
          />
        </Field>
      </View>

      <ErrorText>{error}</ErrorText>
      <Button label={user ? 'Publish listing →' : 'Sign in to publish →'} onPress={submit} loading={busy} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
      <Notice>
        {user
          ? 'Your listing is published immediately and can be removed from its details view at any time.'
          : 'You need a free AgroGear account to publish equipment.'}
      </Notice>
    </View>
  );
}
