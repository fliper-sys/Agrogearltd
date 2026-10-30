import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import { Button, Chip, ErrorText, Field, SelectField, T, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES } from '@/lib/data';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, useBreakpoint } from '@/lib/theme';
import type { Profile, Store } from '@/lib/types';

const card = {
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 18,
  padding: 16,
} as const;

function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'good' | 'bad' | 'info' }) {
  const palette = {
    muted: { bg: colors.imageBg, fg: colors.chipText },
    good: { bg: '#e2f3e8', fg: colors.available },
    bad: { bg: colors.errorBg, fg: colors.error },
    info: { bg: '#e3eef5', fg: '#2d5f80' },
  }[tone];
  return (
    <View style={{ backgroundColor: palette.bg, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 }}>
      <T style={{ color: palette.fg, fontSize: 11, fontWeight: '800' }}>{label}</T>
    </View>
  );
}

function Loading() {
  return <ActivityIndicator color={colors.green} style={{ marginVertical: 30 }} />;
}

function Empty({ children }: { children: string }) {
  return (
    <View style={{ ...card, alignItems: 'center', padding: 30 }}>
      <T style={{ color: colors.muted }}>{children}</T>
    </View>
  );
}

// ───────────────────────── Users ─────────────────────────

type UserRow = Profile & { email?: string | null };

export function AdminUsers() {
  const { user } = useAuth();
  const toast = useToast();
  const { isSm } = useBreakpoint();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [restricting, setRestricting] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: '', city: '', bio: '' });
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: profiles }, { data: priv }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('profile_private').select('id, email'),
    ]);
    const emails = new Map((priv ?? []).map((p: any) => [p.id, p.email]));
    setRows(((profiles as Profile[]) ?? []).map((p) => ({ ...p, email: emails.get(p.id) })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, values: Partial<Profile>, ok: string) => {
    setError(null);
    const { error: err } = await supabase.from('profiles').update(values).eq('id', id);
    if (err) return setError(err.message);
    toast(ok);
    setEditing(null);
    setRestricting(null);
    setReason('');
    load();
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => !q || [r.full_name, r.email, r.city].join(' ').toLowerCase().includes(q));
  }, [rows, query]);

  if (loading) return <Loading />;

  return (
    <View style={{ gap: 12 }}>
      <TextField value={query} onChangeText={setQuery} placeholder="Search by name, email or city..." />
      <ErrorText>{error}</ErrorText>
      {visible.length === 0 ? <Empty>No users match.</Empty> : null}
      {visible.map((u) => {
        const self = u.id === user?.id;
        return (
          <View key={u.id} style={{ ...card, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar url={u.avatar_url} name={u.full_name || u.email || '?'} size={44} />
              <View style={{ flex: 1, gap: 4 }}>
                <T style={{ fontWeight: '800' }}>
                  {u.full_name || '(no name)'} {self ? '(you)' : ''}
                </T>
                <T style={{ fontSize: 12, color: colors.muted }}>
                  {u.email ?? 'no email'}
                  {u.city ? ` · ${u.city}` : ''}
                </T>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={u.role === 'admin' ? 'Admin' : 'User'} tone={u.role === 'admin' ? 'info' : 'muted'} />
                  <Badge label={u.status === 'suspended' ? 'Restricted' : 'Active'} tone={u.status === 'suspended' ? 'bad' : 'good'} />
                </View>
                {u.status === 'suspended' && u.suspended_reason ? (
                  <T style={{ fontSize: 12, color: colors.error }}>Reason: {u.suspended_reason}</T>
                ) : null}
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button
                small
                variant="secondary"
                label={editing === u.id ? 'Close editor' : '✏️ Edit info'}
                onPress={() => {
                  setRestricting(null);
                  setEditing(editing === u.id ? null : u.id);
                  setForm({ full_name: u.full_name ?? '', city: u.city ?? '', bio: u.bio ?? '' });
                }}
              />
              {u.status === 'suspended' ? (
                <Button small label="✓ Restore access" onPress={() => patch(u.id, { status: 'active', suspended_reason: null }, 'Access restored.')} />
              ) : !self ? (
                <Button
                  small
                  variant="secondary"
                  label="🚫 Restrict"
                  onPress={() => {
                    setEditing(null);
                    setRestricting(restricting === u.id ? null : u.id);
                    setReason('');
                  }}
                />
              ) : null}
              {!self ? (
                <Button
                  small
                  variant="secondary"
                  label={u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  onPress={() => patch(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }, u.role === 'admin' ? 'Admin removed.' : 'User is now an admin.')}
                />
              ) : null}
            </View>

            {editing === u.id ? (
              <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
                <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 12 }}>
                  <Field label="Full name" style={{ flex: 1 }}>
                    <TextField value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
                  </Field>
                  <Field label="City" style={{ flex: 1 }}>
                    <TextField value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
                  </Field>
                </View>
                <Field label="About">
                  <TextField value={form.bio} onChangeText={(v) => setForm({ ...form, bio: v })} multiline />
                </Field>
                <Button
                  small
                  label="Save user"
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() =>
                    patch(u.id, { full_name: form.full_name.trim(), city: form.city.trim() || null, bio: form.bio.trim() || null }, 'User updated.')
                  }
                />
              </View>
            ) : null}

            {restricting === u.id ? (
              <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
                <T style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
                  Restricted users can browse but cannot list equipment, send booking requests, add stores or send messages.
                </T>
                <Field label="Reason (shown to the user)">
                  <TextField value={reason} onChangeText={setReason} placeholder="e.g. Misleading listing" />
                </Field>
                <Button
                  small
                  label="Restrict account"
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() => patch(u.id, { status: 'suspended', suspended_reason: reason.trim() || null }, 'Account restricted.')}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ───────────────────────── Listings ─────────────────────────

type ListingRow = {
  id: number;
  owner_id: string | null;
  name: string;
  category: string;
  price_per_day: number;
  location: string;
  description: string;
  emoji: string;
  hidden: boolean;
  featured: boolean;
};

export function AdminListings() {
  const toast = useToast();
  const { isSm } = useBreakpoint();
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', category: '', price: '', location: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('equipment').select('*').order('id', { ascending: false });
    setRows((data as ListingRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: number, values: Partial<ListingRow>, ok: string) => {
    setError(null);
    const { error: err } = await supabase.from('equipment').update(values).eq('id', id);
    if (err) return setError(err.message);
    toast(ok);
    setEditing(null);
    load();
  };

  const remove = async (id: number) => {
    const { error: err } = await supabase.from('equipment').delete().eq('id', id);
    if (err) return setError(err.message);
    toast('Listing deleted.');
    setConfirmDelete(null);
    load();
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => !q || [r.name, r.category, r.location].join(' ').toLowerCase().includes(q));
  }, [rows, query]);

  if (loading) return <Loading />;

  return (
    <View style={{ gap: 12 }}>
      <TextField value={query} onChangeText={setQuery} placeholder="Search listings..." />
      <ErrorText>{error}</ErrorText>
      {visible.length === 0 ? <Empty>No listings match.</Empty> : null}
      {visible.map((r) => (
        <View key={r.id} style={{ ...card, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T style={{ fontSize: 34 }}>{r.emoji}</T>
            <View style={{ flex: 1, gap: 4 }}>
              <T style={{ fontWeight: '800' }}>{r.name}</T>
              <T style={{ fontSize: 12, color: colors.muted }}>
                {r.category} · {r.location} · {money(r.price_per_day)}/day
              </T>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Badge label={r.owner_id ? 'User listing' : 'Showcase'} tone="muted" />
                {r.hidden ? <Badge label="Hidden" tone="bad" /> : <Badge label="Visible" tone="good" />}
                {r.featured ? <Badge label="Featured" tone="info" /> : null}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button
              small
              variant="secondary"
              label={editing === r.id ? 'Close editor' : '✏️ Edit'}
              onPress={() => {
                setEditing(editing === r.id ? null : r.id);
                setForm({ name: r.name, category: r.category, price: String(r.price_per_day), location: r.location, description: r.description });
              }}
            />
            <Button small variant="secondary" label={r.hidden ? '👁 Unhide' : '🙈 Hide'} onPress={() => patch(r.id, { hidden: !r.hidden }, r.hidden ? 'Listing is visible again.' : 'Listing hidden.')} />
            <Button small variant="secondary" label={r.featured ? '☆ Unfeature' : '⭐ Feature'} onPress={() => patch(r.id, { featured: !r.featured }, r.featured ? 'Removed from featured.' : 'Listing featured.')} />
            {confirmDelete === r.id ? (
              <Button small label="Confirm delete" onPress={() => remove(r.id)} />
            ) : (
              <Button small variant="secondary" label="🗑 Delete" onPress={() => setConfirmDelete(r.id)} />
            )}
          </View>
          {editing === r.id ? (
            <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
              <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 12 }}>
                <Field label="Name" style={{ flex: 1 }}>
                  <TextField value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
                </Field>
                <Field label="Category" style={{ flex: 1 }}>
                  <SelectField value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
                </Field>
              </View>
              <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 12 }}>
                <Field label="Daily price (₦)" style={{ flex: 1 }}>
                  <TextField value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboardType="numeric" />
                </Field>
                <Field label="Location" style={{ flex: 1 }}>
                  <TextField value={form.location} onChangeText={(v) => setForm({ ...form, location: v })} />
                </Field>
              </View>
              <Field label="Description">
                <TextField value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline />
              </Field>
              <Button
                small
                label="Save listing"
                style={{ alignSelf: 'flex-start' }}
                onPress={() => {
                  const price = Number(form.price);
                  if (!form.name.trim() || !form.location.trim() || !price || price < 1) return setError('Name, location and a valid price are required.');
                  patch(r.id, { name: form.name.trim(), category: form.category, price_per_day: price, location: form.location.trim(), description: form.description.trim() }, 'Listing updated.');
                }}
              />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── Bookings ─────────────────────────

type BookingRow = {
  id: number;
  renter_name: string;
  renter_phone: string;
  start_date: string;
  end_date: string;
  days: number;
  estimated_total: number;
  note: string | null;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled';
  created_at: string;
  equipment: { name: string; emoji: string } | null;
};

const STATUS_TONE = { pending: 'info', confirmed: 'good', declined: 'bad', cancelled: 'muted' } as const;

export function AdminBookings() {
  const toast = useToast();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | BookingRow['status']>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, equipment(name, emoji)')
      .order('created_at', { ascending: false })
      .limit(300);
    setRows((data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: number, status: BookingRow['status']) => {
    setError(null);
    const { error: err } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (err) return setError(err.message);
    toast(`Booking ${status}.`);
    load();
  };

  if (loading) return <Loading />;
  const visible = rows.filter((r) => filter === 'all' || r.status === filter);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['all', 'pending', 'confirmed', 'declined', 'cancelled'] as const).map((s) => (
          <Chip key={s} label={s[0].toUpperCase() + s.slice(1)} active={filter === s} onPress={() => setFilter(s)} />
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
      {visible.length === 0 ? <Empty>No bookings here yet.</Empty> : null}
      {visible.map((b) => (
        <View key={b.id} style={{ ...card, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <T style={{ fontSize: 26 }}>{b.equipment?.emoji ?? '🚜'}</T>
            <T style={{ fontWeight: '800', flex: 1 }}>{b.equipment?.name ?? 'Removed listing'}</T>
            <Badge label={b.status[0].toUpperCase() + b.status.slice(1)} tone={STATUS_TONE[b.status]} />
          </View>
          <T style={{ fontSize: 13, lineHeight: 20 }}>
            {b.renter_name} · {b.renter_phone}
          </T>
          <T style={{ fontSize: 13, color: colors.muted }}>
            {b.start_date} → {b.end_date} ({b.days} day{b.days === 1 ? '' : 's'}) · {money(b.estimated_total)}
          </T>
          {b.note ? <T style={{ fontSize: 13, fontStyle: 'italic', color: colors.navText }}>“{b.note}”</T> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {b.status !== 'confirmed' ? <Button small label="Confirm" onPress={() => setStatus(b.id, 'confirmed')} /> : null}
            {b.status !== 'declined' ? <Button small variant="secondary" label="Decline" onPress={() => setStatus(b.id, 'declined')} /> : null}
            {b.status !== 'cancelled' ? <Button small variant="secondary" label="Cancel" onPress={() => setStatus(b.id, 'cancelled')} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── Stores ─────────────────────────

export function AdminStores() {
  const toast = useToast();
  const [rows, setRows] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('stores').select('*').order('verified', { ascending: true }).order('created_at', { ascending: false });
    setRows((data as Store[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const verify = async (s: Store) => {
    const { error: err } = await supabase.from('stores').update({ verified: !s.verified }).eq('id', s.id);
    if (err) return setError(err.message);
    toast(s.verified ? 'Store marked unverified.' : 'Store verified.');
    load();
  };

  const remove = async (id: number) => {
    const { error: err } = await supabase.from('stores').delete().eq('id', id);
    if (err) return setError(err.message);
    toast('Store removed.');
    setConfirmDelete(null);
    load();
  };

  if (loading) return <Loading />;

  return (
    <View style={{ gap: 12 }}>
      <ErrorText>{error}</ErrorText>
      {rows.length === 0 ? <Empty>No stores have been added yet.</Empty> : null}
      {rows.map((s) => (
        <View key={s.id} style={{ ...card, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T style={{ fontSize: 30 }}>🏪</T>
            <View style={{ flex: 1, gap: 4 }}>
              <T style={{ fontWeight: '800' }}>{s.name}</T>
              <T style={{ fontSize: 12, color: colors.muted }}>
                {[s.address, s.city].filter(Boolean).join(', ') || 'No address'} · {s.latitude.toFixed(3)}, {s.longitude.toFixed(3)}
                {s.phone ? ` · ${s.phone}` : ''}
              </T>
            </View>
            <Badge label={s.verified ? 'Verified' : 'Unverified'} tone={s.verified ? 'good' : 'muted'} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button small label={s.verified ? 'Unverify' : '✓ Verify'} variant={s.verified ? 'secondary' : 'primary'} onPress={() => verify(s)} />
            {confirmDelete === s.id ? (
              <Button small label="Confirm delete" onPress={() => remove(s.id)} />
            ) : (
              <Button small variant="secondary" label="🗑 Delete" onPress={() => setConfirmDelete(s.id)} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
