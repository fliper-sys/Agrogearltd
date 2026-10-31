import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/geo';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { colors, web } from '@/lib/theme';
import { useToast } from './Toast';
import { Button, Chip, ErrorText, Field, Notice, T, TextField } from './ui';

export const SUPPORT_CATEGORIES = [
  { value: 'booking', label: '📅 A booking' },
  { value: 'payment', label: '💳 Payment' },
  { value: 'account', label: '👤 My account' },
  { value: 'listing', label: '🚜 A listing' },
  { value: 'safety', label: '🛡 Safety / dispute' },
  { value: 'bug', label: '🐞 Something is broken' },
  { value: 'other', label: '💬 Other' },
] as const;

export type Ticket = { id: number; category: string; subject: string; status: 'open' | 'answered' | 'closed'; created_at: string; updated_at: string };
export type TicketMessage = { id: number; ticket_id: number; sender_id: string; is_staff: boolean; body: string; created_at: string };

export const STATUS_LABEL: Record<Ticket['status'], { label: string; bg: string; fg: string }> = {
  open: { label: 'Waiting for support', bg: '#fdf3d9', fg: '#8a6414' },
  answered: { label: 'Support replied', bg: '#e3f3e9', fg: colors.available },
  closed: { label: 'Closed', bg: '#ececec', fg: '#555' },
};

export function StatusTag({ status }: { status: Ticket['status'] }) {
  const s = STATUS_LABEL[status];
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, alignSelf: 'flex-start' }}>
      <T style={{ color: s.fg, fontSize: 11, fontWeight: '800' }}>{s.label}</T>
    </View>
  );
}

/** Conversation with support on one ticket. `staff` shows the admin view of the same thread. */
export function TicketThread({ ticket, staff, onChanged, onBack }: { ticket: Ticket; staff?: boolean; onChanged?: () => void; onBack?: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [msgs, setMsgs] = useState<TicketMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', ticket.id).order('id');
    if (alive.current) setMsgs((data as TicketMessage[]) ?? []);
  }, [ticket.id]);

  useEffect(() => {
    alive.current = true;
    load();
    const ch = supabase
      .channel(`ticket-${ticket.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticket.id}` }, load)
      .subscribe();
    const poll = setInterval(load, 10000);
    return () => {
      alive.current = false;
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [load, ticket.id]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc('support_post', { p_ticket: ticket.id, p_body: text });
    setBusy(false);
    if (e) return setError(e.message);
    setText('');
    await load();
    onChanged?.();
  };

  const setStatus = async (status: Ticket['status']) => {
    const { error: e } = await supabase.rpc('support_set_status', { p_ticket: ticket.id, p_status: status });
    if (e) return setError(e.message);
    toast(status === 'closed' ? 'Ticket closed.' : 'Ticket reopened.');
    onChanged?.();
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {onBack ? <Button small variant="secondary" label="← All tickets" onPress={onBack} /> : null}
        <T style={{ fontWeight: '800', fontSize: 16, flex: 1 }}>{ticket.subject}</T>
        <StatusTag status={ticket.status} />
      </View>
      <View style={{ gap: 8 }}>
        {msgs.map((m) => {
          const fromMe = m.sender_id === user?.id;
          const staffMsg = m.is_staff;
          return (
            <View
              key={m.id}
              style={{
                alignSelf: fromMe ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                backgroundColor: staffMsg ? colors.mint : fromMe ? colors.green : '#fff',
                borderWidth: fromMe || staffMsg ? 0 : 1,
                borderColor: colors.line,
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 14,
              }}
            >
              {staffMsg ? <T style={{ fontSize: 11, fontWeight: '800', color: colors.green, marginBottom: 2 }}>AgroGear support</T> : null}
              <T style={{ color: fromMe && !staffMsg ? '#fff' : colors.ink, lineHeight: 21, fontSize: 14 }}>{m.body}</T>
              <T style={{ color: fromMe && !staffMsg ? colors.heroText : colors.muted, fontSize: 10, marginTop: 4 }}>{timeAgo(m.created_at)}</T>
            </View>
          );
        })}
      </View>
      {ticket.status !== 'closed' || staff ? (
        <View style={{ gap: 8 }}>
          <TextField value={text} onChangeText={setText} multiline placeholder={staff ? 'Reply to the user…' : 'Add more details or reply…'} maxLength={3000} />
          <ErrorText>{error}</ErrorText>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button small label={staff ? 'Send reply' : 'Send'} onPress={send} loading={busy} disabled={!text.trim()} />
            {staff ? (
              ticket.status === 'closed' ? (
                <Button small variant="secondary" label="Reopen" onPress={() => setStatus('open')} />
              ) : (
                <Button small variant="secondary" label="Close ticket" onPress={() => setStatus('closed')} />
              )
            ) : null}
          </View>
        </View>
      ) : (
        <Notice>This ticket is closed. Open a new one if you still need help.</Notice>
      )}
    </View>
  );
}

/** Contact form plus the signed-in user's tickets. */
export function SupportPanel() {
  const { user, profile, displayName } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState<string>('other');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState<Ticket | null>(null);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return;
    const { data } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
    const rows = (data as Ticket[]) ?? [];
    setTickets(rows);
    setOpen((o) => (o ? rows.find((r) => r.id === o.id) ?? o : o));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) {
    return (
      <View style={{ gap: 12 }}>
        <T style={{ lineHeight: 22 }}>Sign in to contact support so we can see your account and bookings.</T>
        <Button label="Sign in" onPress={() => router.push('/auth')} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  }

  const submit = async () => {
    setError(null);
    if (subject.trim().length < 3) return setError('Give your request a short title.');
    if (body.trim().length < 10) return setError('Please describe the problem in a sentence or two.');
    setBusy(true);
    const { data, error: e } = await supabase
      .from('support_tickets')
      .insert({ user_id: user.id, category, subject: subject.trim() })
      .select()
      .single();
    if (e || !data) {
      setBusy(false);
      return setError(e?.message ?? 'Could not create the ticket.');
    }
    const { error: e2 } = await supabase.rpc('support_post', { p_ticket: (data as Ticket).id, p_body: body });
    setBusy(false);
    if (e2) return setError(e2.message);
    toast('Sent. We will reply here and in your notifications.');
    setSubject('');
    setBody('');
    await load();
    setOpen(data as Ticket);
  };

  if (open) return <TicketThread ticket={open} onChanged={load} onBack={() => setOpen(null)} />;

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 14 }}>
        <T style={{ fontSize: 17, fontWeight: '800' }}>Contact support</T>
        <T style={{ color: colors.muted, lineHeight: 22, fontSize: 13 }}>
          Hi {displayName.split(' ')[0] || 'there'} 👋 Tell us what happened. Include the machine name or booking if it helps. We usually reply within one working day.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SUPPORT_CATEGORIES.map((c) => (
            <Chip key={c.value} label={c.label} active={category === c.value} onPress={() => setCategory(c.value)} />
          ))}
        </View>
        <Field label="Title *">
          <TextField value={subject} onChangeText={setSubject} placeholder="e.g. Payment taken but booking still shows approved" maxLength={140} />
        </Field>
        <Field label="Details *">
          <TextField value={body} onChangeText={setBody} multiline maxLength={3000} placeholder="What happened? What did you expect?" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button label="Send to support" onPress={submit} loading={busy} style={{ alignSelf: 'flex-start' }} />
        {profile?.accountStatus === 'suspended' ? <Notice>Your account is restricted. Support can still help: explain why you think this is a mistake.</Notice> : null}
      </View>

      <View style={{ gap: 10 }}>
        <T style={{ fontSize: 17, fontWeight: '800' }}>Your tickets</T>
        {tickets.length === 0 ? <T style={{ color: colors.muted, fontSize: 13 }}>No tickets yet.</T> : null}
        {tickets.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setOpen(t)}
            style={[{ backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, gap: 6 }, web({ cursor: 'pointer' })]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <T style={{ fontWeight: '800', flex: 1 }}>{t.subject}</T>
              <StatusTag status={t.status} />
            </View>
            <T style={{ color: colors.muted, fontSize: 12 }}>Updated {timeAgo(t.updated_at)}</T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
