import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useMarket } from '@/context/MarketContext';
import { CATEGORIES, CONDITIONS, NIGERIA_STATES } from '@/lib/data';
import { colors, useBreakpoint, web } from '@/lib/theme';
import { ImageUploader } from './ImageUploader';
import { useToast } from './Toast';
import { Button, ErrorText, Eyebrow, Field, Notice, SelectField, T, TextField } from './ui';

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, web({ cursor: 'pointer' })]}
    >
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: value ? colors.green : colors.chipBorder, backgroundColor: value ? colors.green : '#fff', alignItems: 'center', justifyContent: 'center' }}>
        {value ? <T style={{ color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 16 }}>✓</T> : null}
      </View>
      <T style={{ fontSize: 14 }}>{label}</T>
    </Pressable>
  );
}

export function ListingForm({ onPublished }: { onPublished: () => void }) {
  const { isSm } = useBreakpoint();
  const { user, profile } = useAuth();
  const { createListing } = useMarket();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [state, setState] = useState('');
  const [town, setTown] = useState('');
  const [condition, setCondition] = useState('Good');
  const [year, setYear] = useState('');
  const [specs, setSpecs] = useState('');
  const [deposit, setDeposit] = useState('');
  const [minDays, setMinDays] = useState('1');
  const [pickup, setPickup] = useState(true);
  const [delivery, setDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [operator, setOperator] = useState(false);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill location from the saved profile.
  useEffect(() => {
    if (profile?.state && !state) setState(profile.state);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setError(null);
    const amount = Number(price);
    if (!name.trim() || !category || !amount || amount < 1 || !state || !town.trim()) {
      return setError('Please complete the required fields.');
    }
    if (!pickup && !delivery) return setError('Offer at least pickup or delivery.');
    if (delivery && !(Number(deliveryFee) >= 0)) return setError('Enter a delivery fee (0 if free).');
    const yr = year ? Number(year) : null;
    if (yr !== null && (yr < 1950 || yr > new Date().getFullYear() + 1)) return setError('Enter a valid year of manufacture.');
    if (!user) {
      toast('Please sign in to publish your equipment.');
      return router.push('/auth');
    }
    setBusy(true);
    const res = await createListing({
      name: name.trim(),
      category,
      price: amount,
      location: `${town.trim()}, ${state}`,
      state,
      description: description.trim(),
      condition,
      yearMade: yr,
      specs: specs.trim(),
      deposit: Math.max(0, Number(deposit) || 0),
      minDays: Math.max(1, Math.floor(Number(minDays) || 1)),
      pickupAvailable: pickup,
      deliveryAvailable: delivery,
      deliveryFee: delivery ? Math.max(0, Number(deliveryFee) || 0) : 0,
      withOperator: operator,
      images,
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    setName(''); setCategory(''); setPrice(''); setTown(''); setCondition('Good'); setYear(''); setSpecs('');
    setDeposit(''); setMinDays('1'); setPickup(true); setDelivery(false); setDeliveryFee(''); setOperator(false);
    setDescription(''); setImages([]);
    toast('Your equipment is now live on the marketplace!');
    onPublished();
  };

  const row = { flexDirection: isSm ? 'column' : 'row', gap: 16 } as const;

  return (
    <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: isSm ? 19 : 27, marginTop: 42 }}>
      <Eyebrow color={colors.green}>For equipment owners</Eyebrow>
      <T style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.7, marginTop: 10, marginBottom: 8 }}>Put your machinery to work.</T>
      <T style={{ color: colors.muted, lineHeight: 24, marginBottom: 20 }}>
        List your equipment on AgroGear and let farmers across Nigeria find and rent it. Verified owners get a badge and rank higher.
      </T>

      {user && profile && profile.verificationStatus !== 'verified' ? (
        <Pressable
          onPress={() => router.push('/profile')}
          style={[{ backgroundColor: '#fdf3d9', borderRadius: 12, padding: 12, marginBottom: 18 }, web({ cursor: 'pointer' })]}
        >
          <T style={{ color: '#8a6414', fontSize: 13, lineHeight: 20 }}>
            {profile.verificationStatus === 'pending'
              ? 'Your ID is under review. Your listings will show a verified badge once approved.'
              : 'Get a verified badge: confirm your identity in Profile & settings →'}
          </T>
        </Pressable>
      ) : null}

      <View style={{ gap: 16 }}>
        <View style={row}>
          <Field label="Equipment name *" style={{ flex: 1 }}>
            <TextField value={name} onChangeText={setName} placeholder="e.g. John Deere 5050D" />
          </Field>
          <Field label="Category *" style={{ flex: 1 }}>
            <SelectField value={category} onChange={setCategory} placeholder="Choose category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
        </View>
        <View style={row}>
          <Field label="State *" style={{ flex: 1 }}>
            <SelectField value={state} onChange={setState} placeholder="Choose state" options={NIGERIA_STATES.map((s) => ({ value: s, label: s }))} />
          </Field>
          <Field label="Town / area *" style={{ flex: 1 }}>
            <TextField value={town} onChangeText={setTown} placeholder="e.g. Gwagwalada" />
          </Field>
        </View>
        <View style={row}>
          <Field label="Daily rental price (₦) *" style={{ flex: 1 }}>
            <TextField value={price} onChangeText={setPrice} placeholder="e.g. 85000" keyboardType="numeric" />
          </Field>
          <Field label="Refundable deposit (₦)" style={{ flex: 1 }}>
            <TextField value={deposit} onChangeText={setDeposit} placeholder="0 for none" keyboardType="numeric" />
          </Field>
        </View>
        <View style={row}>
          <Field label="Condition" style={{ flex: 1 }}>
            <SelectField value={condition} onChange={setCondition} options={CONDITIONS.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Year made" style={{ flex: 1 }}>
            <TextField value={year} onChangeText={setYear} placeholder="e.g. 2018" keyboardType="numeric" />
          </Field>
          <Field label="Minimum days" style={{ flex: 1 }}>
            <TextField value={minDays} onChangeText={setMinDays} placeholder="1" keyboardType="numeric" />
          </Field>
        </View>
        <Field label="Key specs">
          <TextField value={specs} onChangeText={setSpecs} placeholder="e.g. 75 HP, 4WD, 3-point hitch, 12-row" />
        </Field>

        <View style={{ gap: 12, backgroundColor: colors.cream, borderRadius: 14, padding: 14 }}>
          <T style={{ fontWeight: '800', fontSize: 14 }}>Handover options</T>
          <Check label="Renter can collect it (pickup)" value={pickup} onChange={setPickup} />
          <Check label="I can deliver it" value={delivery} onChange={setDelivery} />
          {delivery ? (
            <Field label="Delivery fee (₦)">
              <TextField value={deliveryFee} onChangeText={setDeliveryFee} placeholder="0 if free" keyboardType="numeric" />
            </Field>
          ) : null}
          <Check label="Operator included" value={operator} onChange={setOperator} />
        </View>

        <Field label="Photos">
          {user ? <ImageUploader userId={user.id} paths={images} onChange={setImages} /> : <T style={{ color: colors.muted, fontSize: 12 }}>Sign in to upload photos.</T>}
        </Field>
        <Field label="Description">
          <TextField value={description} onChangeText={setDescription} multiline placeholder="Condition, capacity, implements included, terms…" />
        </Field>
      </View>

      <ErrorText>{error}</ErrorText>
      <Button label={user ? 'Publish listing →' : 'Sign in to publish →'} onPress={submit} loading={busy} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
      <Notice>
        {user
          ? 'Your listing is published immediately. Manage or remove it any time from Profile & settings.'
          : 'You need a free AgroGear account to publish equipment.'}
      </Notice>
    </View>
  );
}
