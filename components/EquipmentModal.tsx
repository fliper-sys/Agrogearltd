import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { BookingResult, useMarket } from '@/context/MarketContext';
import { Equipment } from '@/lib/data';
import { money, todayISO } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, emojiShadow, useBreakpoint, web } from '@/lib/theme';
import { useToast } from './Toast';
import { Button, DateField, Eyebrow, ErrorText, Field, Notice, T, TextField } from './ui';

export function EquipmentModal({ item, onClose }: { item: Equipment | null; onClose: () => void }) {
  const { isSm } = useBreakpoint();
  const { user, displayName } = useAuth();
  const { createBooking, deleteListing } = useMarket();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingResult | null>(null);

  // Reset the form each time a different machine is opened.
  useEffect(() => {
    setName(displayName);
    setPhone('');
    setStart('');
    setEnd('');
    setNote('');
    setError(null);
    setDone(null);
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

  const submit = async () => {
    setError(null);
    if (!name.trim() || !phone.trim() || !start || !end) return setError('Please complete all required fields.');
    if (end < start) return setError('End date must be on or after the start date.');
    setBusy(true);
    const res = await createBooking(item, { name: name.trim(), phone: phone.trim(), start, end, note: note.trim() });
    setBusy(false);
    if (res.error) return setError(res.error);
    setDone(res.result ?? null);
  };

  const messageOwner = async () => {
    if (!user || !item.ownerId) return;
    setError(null);
    setBusy(true);
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('equipment_id', item.id)
      .eq('renter_id', user.id)
      .maybeSingle();
    let conversationId: number | undefined = existing?.id;
    if (!conversationId) {
      const { data, error: err } = await supabase
        .from('conversations')
        .insert({ equipment_id: item.id, renter_id: user.id, owner_id: item.ownerId })
        .select('id')
        .single();
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
                  Booking request sent ✓
                </T>
                <T style={{ lineHeight: 24, marginTop: 14 }}>
                  Your request for <T style={{ fontWeight: '800' }}>{item.name}</T> has been recorded.
                </T>
                <T style={{ lineHeight: 24, marginTop: 8 }}>
                  Dates: {start} to {end} ({done.days} day{done.days === 1 ? '' : 's'})
                </T>
                <T style={{ lineHeight: 24, marginTop: 8 }}>
                  Estimated rental total: <T style={{ fontWeight: '800' }}>{money(done.total)}</T>
                </T>
                <Notice>
                  The owner will contact you on {phone} to confirm availability and final pricing.
                </Notice>
                <Button label="Done" onPress={onClose} style={{ marginTop: 18, alignSelf: 'flex-start' }} />
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
                  }}
                >
                  <Text style={[{ fontSize: 92, lineHeight: 110 }, emojiShadow(9, 5, 'rgba(35,60,37,0.11)')]}>
                    {item.emoji || '🚜'}
                  </Text>
                </View>
                <T style={{ fontSize: 21, fontWeight: '800', color: colors.green }}>
                  {money(item.price)} <T style={{ fontSize: 11, color: colors.muted, fontWeight: '500' }}>/ day · indicative price</T>
                </T>
                <T style={{ color: colors.muted, marginTop: 14 }}>⌖ {item.location}</T>
                <T style={{ lineHeight: 24, marginTop: 14 }}>{item.description}</T>

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
                      <Field label="Message to owner">
                        <TextField
                          value={note}
                          onChangeText={setNote}
                          multiline
                          placeholder="Tell the owner about your farm or equipment needs"
                        />
                      </Field>
                    </View>
                    <ErrorText>{error}</ErrorText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
                      <Button label="Send booking request →" onPress={submit} loading={busy} />
                      {item.ownerId ? <Button variant="secondary" label="💬 Message owner" onPress={messageOwner} disabled={busy} /> : null}
                    </View>
                    <Notice>Your request goes to the equipment owner, who will confirm availability and final pricing.</Notice>
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
