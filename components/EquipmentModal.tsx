import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { profileComplete, useAuth } from '@/context/AuthContext';
import { useMarket } from '@/context/MarketContext';
import { useRentals } from '@/context/RentalsContext';
import { Equipment } from '@/lib/data';
import { money, todayISO } from '@/lib/format';
import { quote } from '@/lib/pricing';
import { overlaps } from '@/lib/search';
import { formatDate } from '@/lib/time';
import { colors, emojiShadow, useBreakpoint, web } from '@/lib/theme';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { ReviewList } from './Reviews';
import { useToast } from './Toast';
import { Stars, VerifiedBadge } from './Badges';
import { Button, Chip, DateField, Eyebrow, ErrorText, Field, Notice, T, TextField } from './ui';

export function EquipmentModal({ item, onClose }: { item: Equipment | null; onClose: () => void }) {
  const { isSm } = useBreakpoint();
  const { user, displayName, profile } = useAuth();
  const { deleteListing, bookedRanges } = useMarket();
  const { createBooking } = useRentals();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [fulfilment, setFulfilment] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState('');
  const [photo, setPhoto] = useState(0);

  const messageOwner = async () => {
    if (!user) return router.push('/auth');
    if (!item?.ownerId) return;
    setError(null);
    setBusy(true);
    const { data: existing } = await supabase
      .from('conversations').select('id').eq('equipment_id', item.id).eq('renter_id', user.id).maybeSingle();
    let conversationId: number | undefined = existing?.id;
    if (!conversationId) {
      const { data, error: err } = await supabase
        .from('conversations')
        .insert({ equipment_id: item.id, renter_id: user.id, owner_id: item.ownerId })
        .select('id').single();
      if (err || !data) {
        setBusy(false);
        return setError(err?.message ?? 'Could not start the conversation.');
      }
      conversationId = data.id;
    }
    setBusy(false);
    onClose();
    router.push(`/chat/${conversationId}`);
  };

  // Reset the form each time a different machine is opened.
  useEffect(() => {
    setName(profile?.fullName || displayName);
    setPhone(profile?.phone ?? '');
    setFulfilment(item?.pickupAvailable === false ? 'delivery' : 'pickup');
    setAddress(profile?.address ?? '');
    setPhoto(0);
    setStart('');
    setEnd('');
    setNote('');
    setError(null);
    setDone(false);
    setBusy(false);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape (web).
  useEffect(() => {
    if (Platform.OS !== 'web' || !item) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;

  const today = todayISO();
  const isOwner = Boolean(user && item.ownerId === user.id);
  const q = quote(item, start, end, fulfilment);
  const itemRanges = bookedRanges.filter((r) => r.equipmentId === item.id);
  const clash = Boolean(start && end && itemRanges.some((r) => overlaps(r.start, r.end, start, end)));
  const needsProfile = Boolean(user && profile && !profileComplete(profile));

  const submit = async () => {
    setError(null);
    if (!name.trim() || !phone.trim() || !start || !end) return setError('Please complete all required fields.');
    if (end < start) return setError('End date must be on or after the start date.');
    if (!q) return setError('Choose valid dates.');
    if (q.days < item.minDays) return setError(`Minimum rental for this machine is ${item.minDays} day${item.minDays === 1 ? '' : 's'}.`);
    if (clash) return setError('Those dates are already booked. Pick different dates.');
    if (fulfilment === 'delivery' && address.trim().length < 5) return setError('Enter a delivery address.');
    setBusy(true);
    const res = await createBooking(item.id, { name: name.trim(), phone: phone.trim(), start, end, note: note.trim(), fulfilment, address: address.trim() });
    setBusy(false);
    if (res.error) return setError(res.error);
    setDone(true);
  };

  const remove = async () => {
    setBusy(true);
    const res = await deleteListing(item.id);
    setBusy(false);
    if (res.error) return setError(res.error);
    toast('Listing removed.');
    onClose();
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 18 }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
        <View
          style={{
            width: '100%',
            maxWidth: 560,
            maxHeight: '90%',
            backgroundColor: colors.cream,
            borderRadius: 22,
            overflow: 'hidden',
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 26 }} keyboardShouldPersistTaps="handled">
            {done ? (
              <View>
                <T style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 8, marginRight: 42 }}>
                  Request sent ✓
                </T>
                <T style={{ lineHeight: 24, marginTop: 14 }}>
                  Your request for <T style={{ fontWeight: '800' }}>{item.name}</T> is with the owner.
                </T>
                <T style={{ lineHeight: 24, marginTop: 8 }}>
                  Dates: {formatDate(start)} to {formatDate(end)} ({q?.days} day{q?.days === 1 ? '' : 's'})
                </T>
                <T style={{ lineHeight: 24, marginTop: 8 }}>
                  Total if approved: <T style={{ fontWeight: '800' }}>{q ? money(q.total) : ''}</T>
                </T>
                <Notice>
                  Next: the owner approves, you pay (held securely), the machine is delivered or collected, and your rental countdown starts when you confirm you have it. Track every step in My rentals.
                </Notice>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                  <Button label="Track in My rentals →" onPress={() => { onClose(); router.push('/rentals'); }} />
                  <Button variant="secondary" label="Done" onPress={onClose} />
                </View>
              </View>
            ) : (
              <View>
                <View style={{ marginRight: 42 }}>
                  <Eyebrow color={colors.green}>{item.category}</Eyebrow>
                  <T style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 8, marginBottom: 8 }}>
                    {item.name}
                  </T>
                </View>
                <View
                  style={{
                    height: isSm ? 205 : 190,
                    borderRadius: 15,
                    marginVertical: 15,
                    backgroundColor: item.color || '#e8eee4',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {item.images[photo] ? (
                    <Image source={{ uri: item.images[photo] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Text style={[{ fontSize: 92, lineHeight: 110 }, emojiShadow(9, 5, 'rgba(35,60,37,0.11)')]}>
                      {item.emoji || '🚜'}
                    </Text>
                  )}
                </View>
                {item.images.length > 1 ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                    {item.images.map((u, i) => (
                      <Pressable key={u} onPress={() => setPhoto(i)} style={[{ borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: i === photo ? colors.green : 'transparent' }, web({ cursor: 'pointer' })]}>
                        <Image source={{ uri: u }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <T style={{ fontSize: 21, fontWeight: '800', color: colors.green }}>
                  {money(item.price)} <T style={{ fontSize: 11, color: colors.muted, fontWeight: '500' }}>/ day · indicative price</T>
                </T>
                <T style={{ color: colors.muted, marginTop: 14 }}>⌖ {item.location}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  {item.ownerVerified ? <VerifiedBadge /> : null}
                  <Stars rating={item.avgRating} count={item.reviewCount} size={13} />
                  {item.ownerName ? (
                    <Pressable
                      disabled={!item.ownerId}
                      onPress={() => { onClose(); router.push(`/u/${item.ownerId}`); }}
                      style={web({ cursor: item.ownerId ? 'pointer' : 'default' })}
                    >
                      <T style={{ fontSize: 12, color: item.ownerId ? colors.green : colors.muted, fontWeight: item.ownerId ? '700' : '400' }}>Owner: {item.ownerName}{item.ownerId ? ' →' : ''}</T>
                    </Pressable>
                  ) : null}
                </View>
                <T style={{ lineHeight: 24, marginTop: 14 }}>{item.description}</T>
                <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 14, gap: 6 }}>
                  <T style={{ fontSize: 13 }}>Condition: <T style={{ fontWeight: '700' }}>{item.condition}</T>{item.yearMade ? ` · ${item.yearMade}` : ''}</T>
                  {item.specs ? <T style={{ fontSize: 13 }}>Specs: {item.specs}</T> : null}
                  <T style={{ fontSize: 13 }}>
                    {[item.pickupAvailable ? 'Pickup' : null, item.deliveryAvailable ? `Delivery (${item.deliveryFee ? money(item.deliveryFee) : 'free'})` : null, item.withOperator ? 'Operator included' : null].filter(Boolean).join(' · ')}
                  </T>
                  {item.deposit > 0 ? <T style={{ fontSize: 13 }}>Refundable deposit: {money(item.deposit)}</T> : null}
                  {item.minDays > 1 ? <T style={{ fontSize: 13 }}>Minimum rental: {item.minDays} days</T> : null}
                  {itemRanges.length ? (
                    <T style={{ fontSize: 12, color: colors.muted }}>
                      Booked: {itemRanges.slice(0, 4).map((r) => `${formatDate(r.start)}–${formatDate(r.end)}`).join(', ')}
                    </T>
                  ) : null}
                </View>

                {item.ownerId ? (
                  <View style={{ marginTop: 22 }}>
                    <T style={{ fontSize: 17, fontWeight: '800', marginBottom: 12 }}>Reviews</T>
                    <ReviewList equipmentId={item.id} limit={3} />
                  </View>
                ) : null}
                {isOwner ? (
                  <View style={{ marginTop: 22 }}>
                    <T style={{ fontSize: 17, fontWeight: '800' }}>This is your listing</T>
                    <Notice>Renters can request it from the marketplace. You can remove it at any time.</Notice>
                    <ErrorText>{error}</ErrorText>
                    <Button variant="secondary" label="Remove listing" onPress={remove} loading={busy} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
                  </View>
                ) : !user ? (
                  <View style={{ marginTop: 22 }}>
                    <T style={{ fontSize: 17, fontWeight: '800' }}>Request a rental</T>
                    <Notice>Create a free account or sign in to send a booking request to the owner.</Notice>
                    <Button
                      label="Sign in to request →"
                      style={{ marginTop: 14, alignSelf: 'flex-start' }}
                      onPress={() => {
                        onClose();
                        router.push('/auth');
                      }}
                    />
                  </View>
                ) : (
                  <View style={{ marginTop: 22 }}>
                    <T style={{ fontSize: 17, fontWeight: '800', marginBottom: 14 }}>Request a rental</T>
                    {needsProfile ? (
                      <Pressable onPress={() => { onClose(); router.push('/profile'); }} style={[{ backgroundColor: '#fdf3d9', borderRadius: 12, padding: 12, marginBottom: 14 }, web({ cursor: 'pointer' })]}>
                        <T style={{ color: '#8a6414', fontSize: 13, lineHeight: 20 }}>Complete your profile (name, phone, state) so owners can trust your request →</T>
                      </Pressable>
                    ) : null}
                    <View style={{ gap: 16 }}>
                      <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 16 }}>
                        <Field label="Your name *" style={{ flex: 1 }}>
                          <TextField value={name} onChangeText={setName} placeholder="Full name" />
                        </Field>
                        <Field label="Phone number *" style={{ flex: 1 }}>
                          <TextField value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
                        </Field>
                      </View>
                      <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 16 }}>
                        <Field label="Start date *" style={{ flex: 1 }}>
                          <DateField
                            value={start}
                            min={today}
                            onChange={(v) => {
                              setStart(v);
                              if (end && v && end < v) setEnd(v);
                            }}
                          />
                        </Field>
                        <Field label="End date *" style={{ flex: 1 }}>
                          <DateField value={end} min={start || today} onChange={setEnd} />
                        </Field>
                      </View>
                      {item.pickupAvailable && item.deliveryAvailable ? (
                        <Field label="How do you want to get it?">
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Chip label="I will collect it" active={fulfilment === 'pickup'} onPress={() => setFulfilment('pickup')} />
                            <Chip label="Deliver to my farm" active={fulfilment === 'delivery'} onPress={() => setFulfilment('delivery')} />
                          </View>
                        </Field>
                      ) : null}
                      {fulfilment === 'delivery' ? (
                        <Field label="Delivery address *">
                          <TextField value={address} onChangeText={setAddress} placeholder="Farm location, town, LGA, landmark" />
                        </Field>
                      ) : null}
                      <Field label="Message to owner">
                        <TextField
                          value={note}
                          onChangeText={setNote}
                          multiline
                          placeholder="Tell the owner about your farm or equipment needs"
                        />
                      </Field>
                    </View>
                    {clash ? <ErrorText>Those dates overlap an existing booking.</ErrorText> : null}
                    {q ? (
                      <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 16, gap: 6 }}>
                        <T style={{ fontSize: 13 }}>{q.days} day{q.days === 1 ? '' : 's'} × {money(item.price)} = {money(q.rental)}</T>
                        {q.delivery > 0 ? <T style={{ fontSize: 13 }}>Delivery: {money(q.delivery)}</T> : null}
                        {q.serviceFee > 0 ? <T style={{ fontSize: 13 }}>Service fee: {money(q.serviceFee)}</T> : null}
                        {q.deposit > 0 ? <T style={{ fontSize: 13 }}>Refundable deposit: {money(q.deposit)}</T> : null}
                        <T style={{ fontSize: 16, fontWeight: '800', color: colors.green, marginTop: 4 }}>Total: {money(q.total)}</T>
                      </View>
                    ) : null}
                    <ErrorText>{error}</ErrorText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
                      <Button label="Send booking request →" onPress={submit} loading={busy} disabled={clash} />
                      {item.ownerId && item.ownerId !== user?.id && isSupabaseConfigured ? (
                        <Button variant="secondary" label="💬 Message owner" onPress={messageOwner} disabled={busy} />
                      ) : null}
                    </View>
                    <Notice>You pay only after the owner approves. Your payment is held securely until the rental is complete.</Notice>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={onClose}
            style={[
              {
                position: 'absolute',
                right: 18,
                top: 15,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
              },
              web({ cursor: 'pointer' }),
            ]}
          >
            <T style={{ fontSize: 20, lineHeight: 24 }}>×</T>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
