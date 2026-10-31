import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import { Button, Chip, ErrorText, Field, SelectField, T, TextField } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES, ID_TYPES, NIGERIA_STATES } from '@/lib/data';
import { money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/geo';
import { StatusTag, TicketThread } from '@/components/SupportPanel';
import { colors, useBreakpoint, web } from '@/lib/theme';
import type { Store } from '@/lib/types';

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

type UserRow = {
  id: string;
  email: string | null;
  full_name: string;
  phone: string;
  state: string;
  avatar_url: string | null;
  verification_status: string;
  is_admin: boolean;
  account_status: 'active' | 'suspended';
  suspended_reason: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

type UserPatch = { full_name?: string; phone?: string; state?: string; status?: 'active' | 'suspended'; reason?: string; is_admin?: boolean };

export function AdminUsers() {
  const { user } = useAuth();
  const toast = useToast();
  const { isSm } = useBreakpoint();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [restricting, setRestricting] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: '', phone: '', state: '' });
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('admin_list_users');
    if (err) setError(err.message);
    setRows((data as UserRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, values: UserPatch, ok: string) => {
    setError(null);
    const { error: err } = await supabase.rpc('admin_update_user', {
      p_user: id,
      p_full_name: values.full_name ?? null,
      p_phone: values.phone ?? null,
      p_state: values.state ?? null,
      p_status: values.status ?? null,
      p_reason: values.reason ?? null,
      p_is_admin: values.is_admin ?? null,
    });
    if (err) return setError(err.message);
    toast(ok);
    setEditing(null);
    setRestricting(null);
    setReason('');
    load();
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => !q || [r.full_name, r.email, r.state, r.phone].join(' ').toLowerCase().includes(q));
  }, [rows, query]);

  if (loading) return <Loading />;

  return (
    <View style={{ gap: 12 }}>
      <TextField value={query} onChangeText={setQuery} placeholder="Search by name, email, phone or state..." />
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
                  {u.state ? ` · ${u.state}` : ''}{u.phone ? ` · ${u.phone}` : ''}
                </T>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={u.is_admin ? 'Admin' : 'User'} tone={u.is_admin ? 'info' : 'muted'} />
                  <Badge label={u.account_status === 'suspended' ? 'Restricted' : 'Active'} tone={u.account_status === 'suspended' ? 'bad' : 'good'} />
                  {u.verification_status === 'verified' ? <Badge label="Verified ID" tone="good" /> : u.verification_status === 'pending' ? <Badge label="ID pending" tone="info" /> : null}
                </View>
                {u.account_status === 'suspended' && u.suspended_reason ? (
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
                  setForm({ full_name: u.full_name ?? '', phone: u.phone ?? '', state: u.state ?? '' });
                }}
              />
              {u.account_status === 'suspended' ? (
                <Button small label="✓ Restore access" onPress={() => patch(u.id, { status: 'active' }, 'Access restored.')} />
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
                  label={u.is_admin ? 'Remove admin' : 'Make admin'}
                  onPress={() => patch(u.id, { is_admin: !u.is_admin }, u.is_admin ? 'Admin removed.' : 'User is now an admin.')}
                />
              ) : null}
            </View>

            {editing === u.id ? (
              <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
                <View style={{ flexDirection: isSm ? 'column' : 'row', gap: 12 }}>
                  <Field label="Full name" style={{ flex: 1 }}>
                    <TextField value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
                  </Field>
                  <Field label="Phone" style={{ flex: 1 }}>
                    <TextField value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
                  </Field>
                </View>
                <Field label="State">
                  <SelectField value={form.state} onChange={(v) => setForm({ ...form, state: v })} placeholder="Choose state" options={NIGERIA_STATES.map((x) => ({ value: x, label: x }))} />
                </Field>
                <Button
                  small
                  label="Save user"
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() =>
                    patch(u.id, { full_name: form.full_name.trim(), phone: form.phone.trim(), state: form.state }, 'User updated.')
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
                  onPress={() => patch(u.id, { status: 'suspended', reason: reason.trim() }, 'Account restricted.')}
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
  is_active: boolean;
  moderated: boolean;
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

  const setVisible = async (id: number, visible: boolean) => {
    setError(null);
    const { error: err } = await supabase.rpc('admin_set_listing', { p_equipment: id, p_visible: visible });
    if (err) return setError(err.message);
    toast(visible ? 'Listing is visible again.' : 'Listing hidden.');
    load();
  };

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
                {!r.is_active ? <Badge label={r.moderated ? 'Hidden by admin' : 'Hidden by owner'} tone="bad" /> : <Badge label="Visible" tone="good" />}
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
            <Button small variant="secondary" label={r.is_active ? '🙈 Hide' : '👁 Unhide'} onPress={() => setVisible(r.id, !r.is_active)} />
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

type BookingStatus =
  | 'pending' | 'approved' | 'paid' | 'dispatched' | 'active' | 'returned' | 'completed'
  | 'declined' | 'cancelled' | 'disputed';

type BookingRow = {
  id: number;
  renter_name: string;
  renter_phone: string;
  start_date: string;
  end_date: string;
  days: number;
  grand_total: number;
  payment_status: string;
  fulfilment: string;
  note: string | null;
  dispute_reason: string | null;
  status: BookingStatus;
  created_at: string;
  equipment: { name: string; emoji: string } | null;
};

const STATUS_TONE: Record<BookingStatus, 'info' | 'good' | 'bad' | 'muted'> = {
  pending: 'info', approved: 'info', paid: 'good', dispatched: 'good', active: 'good', returned: 'info',
  completed: 'good', declined: 'bad', cancelled: 'muted', disputed: 'bad',
};
const FILTERS = ['all', 'pending', 'approved', 'paid', 'dispatched', 'active', 'returned', 'completed', 'disputed', 'declined', 'cancelled'] as const;

/** Read-only view of every booking. Lifecycle changes stay with the owner and renter (they go through server rules). */
export function AdminBookings() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('bookings')
      .select('*, equipment(name, emoji)')
      .order('created_at', { ascending: false })
      .limit(300);
    if (err) setError(err.message);
    setRows((data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;
  const visible = rows.filter((r) => filter === 'all' || r.status === filter);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map((s) => (
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
            <Badge label={b.status[0].toUpperCase() + b.status.slice(1)} tone={STATUS_TONE[b.status] ?? 'muted'} />
          </View>
          <T style={{ fontSize: 13, lineHeight: 20 }}>
            {b.renter_name} · {b.renter_phone}
          </T>
          <T style={{ fontSize: 13, color: colors.muted }}>
            {b.start_date} → {b.end_date} ({b.days} day{b.days === 1 ? '' : 's'}) · {money(b.grand_total)} · payment {b.payment_status} · {b.fulfilment}
          </T>
          {b.note ? <T style={{ fontSize: 13, fontStyle: 'italic', color: colors.navText }}>“{b.note}”</T> : null}
          {b.dispute_reason ? <T style={{ fontSize: 13, color: colors.error }}>Dispute: {b.dispute_reason}</T> : null}
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

// ───────────────────────── Verification queue (from v2) ─────────────────────────

type Pending = { id: string; full_name: string; phone: string; state: string; id_type: string; id_number_last4: string; id_doc_path: string };

export function AdminVerification({ onChange }: { onChange?: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('profiles').select('*').eq('verification_status', 'pending').order('updated_at');
    if (e) setError(e.message);
    else setRows((data ?? []) as Pending[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDoc = async (path: string) => {
    const { data, error: e } = await supabase.storage.from('verification-docs').createSignedUrl(path, 120);
    if (e || !data) return setError(e?.message ?? 'Could not open the document.');
    window.open(data.signedUrl, '_blank');
  };

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    setError(null);
    const { error: e } = await supabase.rpc('review_verification', { p_user: id, p_approve: approve, p_reason: reasons[id] ?? null });
    setBusy(null);
    if (e) return setError(e.message);
    toast(approve ? 'Approved.' : 'Rejected.');
    load();
    onChange?.();
  };

  if (loading) return <Loading />;
  return (
    <View style={{ gap: 12 }}>
      <T style={{ color: colors.muted, fontSize: 13 }}>Check that the ID matches the name on the profile, then approve or reject.</T>
      <ErrorText>{error}</ErrorText>
      {rows.length === 0 ? <Empty>Nothing waiting for review. 🎉</Empty> : null}
      {rows.map((r) => (
        <View key={r.id} style={{ ...card, gap: 6 }}>
          <T style={{ fontSize: 18, fontWeight: '800' }}>{r.full_name}</T>
          <T style={{ color: colors.muted }}>{r.phone} · {r.state}</T>
          <T style={{ marginTop: 4 }}>{ID_TYPES.find((t) => t.value === r.id_type)?.label ?? r.id_type} · ends {r.id_number_last4}</T>
          <Button variant="secondary" small label="View document ↗" onPress={() => openDoc(r.id_doc_path)} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          <View style={{ marginTop: 8 }}>
            <TextField value={reasons[r.id] ?? ''} onChangeText={(v) => setReasons((p) => ({ ...p, [r.id]: v }))} placeholder="Reason (shown to the user if you reject)" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Button label="Approve" small onPress={() => decide(r.id, true)} loading={busy === r.id} />
            <Button variant="secondary" small label="Reject" onPress={() => decide(r.id, false)} disabled={busy === r.id} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── Support inbox ─────────────────────────

type InboxRow = {
  id: number; user_id: string; user_name: string | null; user_email: string | null;
  category: string; subject: string; status: 'open' | 'answered' | 'closed'; created_at: string; updated_at: string;
};

export function AdminSupport({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<InboxRow | null>(null);
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('admin_support_inbox');
    if (e) setError(e.message);
    const list = (data as InboxRow[]) ?? [];
    setRows(list);
    setOpen((o) => (o ? list.find((r) => r.id === o.id) ?? o : o));
    setLoading(false);
    onChange?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;

  if (open) {
    return (
      <View style={{ gap: 12 }}>
        <View style={{ ...card, gap: 4 }}>
          <T style={{ fontWeight: '800' }}>{open.user_name || 'User'} · {open.user_email ?? 'no email'}</T>
          <T style={{ color: colors.muted, fontSize: 12 }}>Category: {open.category}</T>
        </View>
        <View style={card}>
          <TicketThread ticket={open} staff onChanged={load} onBack={() => setOpen(null)} />
        </View>
      </View>
    );
  }

  const visible = rows.filter((r) => (filter === 'all' ? true : filter === 'closed' ? r.status === 'closed' : r.status !== 'closed'));
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip label="Needs attention" active={filter === 'active'} onPress={() => setFilter('active')} />
        <Chip label="Closed" active={filter === 'closed'} onPress={() => setFilter('closed')} />
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
      </View>
      <ErrorText>{error}</ErrorText>
      {visible.length === 0 ? <Empty>No support tickets here. 🎉</Empty> : null}
      {visible.map((r) => (
        <Pressable key={r.id} onPress={() => setOpen(r)} style={[{ ...card, gap: 6 }, web({ cursor: 'pointer' })]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <T style={{ fontWeight: '800', flex: 1 }}>{r.subject}</T>
            <StatusTag status={r.status} />
          </View>
          <T style={{ color: colors.muted, fontSize: 12 }}>
            {r.user_name || 'User'} · {r.user_email ?? 'no email'} · {r.category} · updated {timeAgo(r.updated_at)}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
