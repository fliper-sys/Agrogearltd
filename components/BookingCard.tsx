import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Action, Booking, BookingStatus, useRentals } from '@/context/RentalsContext';
import { useMarket } from '@/context/MarketContext';
import { money } from '@/lib/format';
import { colors, web } from '@/lib/theme';
import { formatDate, formatDateTime } from '@/lib/time';
import { StatusPill } from './Badges';
import { Countdown } from './Countdown';
import { Card } from './PageShell';
import { useToast } from './Toast';
import { Button, ErrorText, Field, Notice, T, TextField } from './ui';

const STEPS: { key: BookingStatus; label: string }[] = [
  { key: 'pending', label: 'Requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'active', label: 'In use' },
  { key: 'returned', label: 'Returned' },
  { key: 'completed', label: 'Done' },
];

function Timeline({ status }: { status: BookingStatus }) {
  const idx = STEPS.findIndex((s) => s.key === status);
  if (idx < 0) return null;
  return (
    <View style={{ flexDirection: 'row', marginTop: 16 }}>
      {STEPS.map((s, i) => {
        const done = i <= idx;
        return (
          <View key={s.key} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 3, backgroundColor: i === 0 ? 'transparent' : i <= idx ? colors.green : colors.line }} />
              <View
                style={{
                  width: 16, height: 16, borderRadius: 8,
                  backgroundColor: done ? colors.green : '#fff',
                  borderWidth: 2, borderColor: done ? colors.green : colors.chipBorder,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {i === idx ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} /> : null}
              </View>
              <View style={{ flex: 1, height: 3, backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < idx ? colors.green : colors.line }} />
            </View>
            <T style={{ fontSize: 9, marginTop: 5, textAlign: 'center', color: done ? colors.green : colors.muted, fontWeight: i === idx ? '800' : '500' }}>{s.label}</T>
          </View>
        );
      })}
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
      <T style={{ color: colors.muted, fontSize: 13 }}>{label}</T>
      <T style={{ fontSize: 13, fontWeight: bold ? '800' : '600' }}>{value}</T>
    </View>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} onPress={() => onChange(n)} style={web({ cursor: 'pointer' })}>
          <T style={{ fontSize: 28, color: n <= value ? '#d79b2d' : '#d6d9d0' }}>★</T>
        </Pressable>
      ))}
    </View>
  );
}

type NoteSpec = { action: Action; title: string; placeholder: string; confirm: string; required?: boolean };

export function BookingCard({ booking: b, role }: { booking: Booking; role: 'renter' | 'owner' }) {
  const { equipment } = useMarket();
  const { act, pay, review, ownerContact } = useRentals();
  const toast = useToast();
  const item = equipment.find((e) => e.id === b.equipmentId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteSpec, setNoteSpec] = useState<NoteSpec | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [contact, setContact] = useState<{ name: string; phone: string } | null>(null);

  useEffect(() => {
    if (role === 'renter' && ['approved', 'paid', 'dispatched', 'active', 'returned', 'completed'].includes(b.status)) {
      ownerContact(b.id).then(setContact);
    }
  }, [role, b.id, b.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action: Action, n?: string, okMsg?: string) => {
    setBusy(true);
    setError(null);
    const res = await act(b.id, action, n);
    setBusy(false);
    if (res.error) return setError(res.error);
    setNoteSpec(null);
    setNote('');
    if (okMsg) toast(okMsg);
  };

  const askNote = (spec: NoteSpec) => {
    setError(null);
    setNote('');
    setNoteSpec(spec);
  };

  const doPay = async () => {
    setBusy(true);
    setError(null);
    const res = await pay(b);
    setBusy(false);
    if (res.cancelled) return toast('Payment cancelled.');
    if (res.error) return setError(res.error);
    toast('Payment received and held securely.');
  };

  const submitReview = async () => {
    setBusy(true);
    setError(null);
    const res = await review(b.id, rating, comment.trim());
    setBusy(false);
    if (res.error) return setError(res.error);
    toast('Thanks for your review!');
  };

  const startsAt = new Date(b.startDate + 'T08:00:00').toISOString();
  const waitingForStart = (b.status === 'paid' || b.status === 'dispatched') && new Date(startsAt).getTime() > Date.now();

  const actions: React.ReactNode[] = [];
  if (role === 'owner') {
    if (b.status === 'pending') {
      actions.push(<Button key="a" label="Approve request" onPress={() => run('approve', undefined, 'Approved. The renter can now pay.')} loading={busy} />);
      actions.push(<Button key="d" variant="secondary" label="Decline" onPress={() => askNote({ action: 'decline', title: 'Reason (optional)', placeholder: 'e.g. Machine is booked elsewhere', confirm: 'Decline request' })} />);
    }
    if (b.status === 'approved') actions.push(<Button key="c" variant="secondary" label="Cancel booking" onPress={() => askNote({ action: 'cancel', title: 'Reason (optional)', placeholder: 'Why are you cancelling?', confirm: 'Cancel booking' })} />);
    if (b.status === 'paid') {
      actions.push(<Button key="s" label={b.fulfilment === 'delivery' ? 'Mark dispatched' : 'Mark ready for pickup'} onPress={() => askNote({ action: 'dispatch', title: 'Handover notes (optional)', placeholder: 'Driver, plate number, where to collect, condition photos sent…', confirm: b.fulfilment === 'delivery' ? 'Confirm dispatch' : 'Confirm ready' })} />);
      actions.push(<Button key="c" variant="secondary" label="Cancel & refund" onPress={() => askNote({ action: 'cancel', title: 'Reason', placeholder: 'Why are you cancelling? The renter is refunded.', confirm: 'Cancel & refund' })} />);
    }
    if (b.status === 'returned') actions.push(<Button key="o" label="Confirm return & release deposit" onPress={() => run('complete', undefined, 'Rental completed. Deposit released.')} loading={busy} />);
  } else {
    if (b.status === 'pending') actions.push(<Button key="c" variant="secondary" label="Cancel request" onPress={() => run('cancel', undefined, 'Request cancelled.')} loading={busy} />);
    if (b.status === 'approved') {
      actions.push(<Button key="p" label={`Pay ${money(b.grandTotal)} →`} onPress={doPay} loading={busy} />);
      actions.push(<Button key="c" variant="secondary" label="Cancel" onPress={() => run('cancel', undefined, 'Booking cancelled.')} />);
    }
    if (b.status === 'paid') actions.push(<Button key="c" variant="secondary" label="Cancel & refund" onPress={() => run('cancel', undefined, 'Booking cancelled. Payment refunded.')} loading={busy} />);
    if (b.status === 'dispatched') actions.push(<Button key="r" label="I have received the machine" onPress={() => run('confirm_received', undefined, 'Rental started. Countdown is running.')} loading={busy} />);
    if (b.status === 'active') actions.push(<Button key="r" label="Mark as returned" onPress={() => askNote({ action: 'return', title: 'Return notes (optional)', placeholder: 'Where and when you returned it, fuel level, any issues…', confirm: 'Confirm return' })} />);
  }
  if (['dispatched', 'active', 'returned'].includes(b.status)) {
    actions.push(<Button key="x" variant="secondary" label="Report a problem" onPress={() => askNote({ action: 'dispute', title: 'What went wrong?', placeholder: 'Describe the problem in detail (at least 10 characters).', confirm: 'Open dispute', required: true })} />);
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <View style={{ flexShrink: 1 }}>
          <T style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.4 }}>{item ? `${item.emoji} ${item.name}` : `Equipment #${b.equipmentId}`}</T>
          <T style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
            {formatDate(b.startDate)} → {formatDate(b.endDate)} · {b.days} day{b.days === 1 ? '' : 's'} · {b.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}
          </T>
        </View>
        <StatusPill status={b.status} />
      </View>

      <Timeline status={b.status} />

      {b.status === 'active' ? <Countdown target={b.rentalEndsAt} label="Time left in your rental" doneLabel="Rental period ended" /> : null}
      {waitingForStart ? <Countdown target={startsAt} label={b.status === 'dispatched' ? 'Rental period starts in' : 'Your rental starts in'} /> : null}

      <View style={{ marginTop: 14, backgroundColor: colors.cream, borderRadius: 12, padding: 12 }}>
        <Row label={`Rental (${b.days} × ${money(b.rentalTotal / Math.max(1, b.days))})`} value={money(b.rentalTotal)} />
        {b.deliveryFee > 0 ? <Row label="Delivery" value={money(b.deliveryFee)} /> : null}
        {b.serviceFee > 0 ? <Row label="Service fee" value={money(b.serviceFee)} /> : null}
        {b.deposit > 0 ? <Row label="Refundable deposit" value={money(b.deposit)} /> : null}
        <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 8 }} />
        <Row label={b.paymentStatus === 'unpaid' ? 'Total due' : b.paymentStatus === 'held' ? 'Total · held securely' : b.paymentStatus === 'refunded' ? 'Total · refunded' : 'Total · paid'} value={money(b.grandTotal)} bold />
      </View>

      <View style={{ marginTop: 12, gap: 4 }}>
        {role === 'owner' ? (
          <>
            <T style={{ fontSize: 13 }}>Renter: <T style={{ fontWeight: '700' }}>{b.renterName}</T> · {b.renterPhone}</T>
            {b.deliveryAddress ? <T style={{ fontSize: 13 }}>Deliver to: {b.deliveryAddress}</T> : null}
          </>
        ) : contact ? (
          <T style={{ fontSize: 13 }}>Owner: <T style={{ fontWeight: '700' }}>{contact.name}</T>{contact.phone ? ` · ${contact.phone}` : ''}</T>
        ) : null}
        {b.note ? <T style={{ fontSize: 13, color: colors.muted }}>Note: {b.note}</T> : null}
        {b.handoverNote ? <T style={{ fontSize: 13, color: colors.muted }}>Handover: {b.handoverNote}</T> : null}
        {b.returnNote ? <T style={{ fontSize: 13, color: colors.muted }}>Return: {b.returnNote}</T> : null}
        {b.cancelReason ? <T style={{ fontSize: 13, color: colors.muted }}>Reason: {b.cancelReason}</T> : null}
        {b.disputeReason ? <T style={{ fontSize: 13, color: colors.error }}>Dispute: {b.disputeReason}</T> : null}
        {b.paidAt ? <T style={{ fontSize: 12, color: colors.muted }}>Paid {formatDateTime(b.paidAt)}{b.deliveredAt ? ` · Received ${formatDateTime(b.deliveredAt)}` : ''}</T> : null}
      </View>

      {noteSpec ? (
        <View style={{ marginTop: 14 }}>
          <Field label={noteSpec.title}>
            <TextField value={note} onChangeText={setNote} multiline placeholder={noteSpec.placeholder} />
          </Field>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <Button label={noteSpec.confirm} onPress={() => run(noteSpec.action, note.trim() || undefined, 'Updated.')} loading={busy} />
            <Button variant="secondary" label="Back" onPress={() => setNoteSpec(null)} />
          </View>
        </View>
      ) : actions.length ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>{actions}</View>
      ) : null}

      {role === 'renter' && b.status === 'completed' && !b.reviewed ? (
        <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 }}>
          <T style={{ fontWeight: '800', marginBottom: 8 }}>How was this rental?</T>
          <StarPicker value={rating} onChange={setRating} />
          <View style={{ marginTop: 10 }}>
            <TextField value={comment} onChangeText={setComment} multiline placeholder="Condition of the machine, owner communication, delivery…" />
          </View>
          <Button label="Submit review" onPress={submitReview} loading={busy} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      {role === 'renter' && b.status === 'completed' && b.reviewed ? <Notice>You reviewed this rental. Thank you!</Notice> : null}
      {b.status === 'approved' && role === 'renter' ? <Notice>Your payment is held securely and only released to the owner once the rental is complete.</Notice> : null}
      {b.status === 'disputed' ? <Notice>The AgroGear team will review this dispute. Payment stays on hold until it is resolved.</Notice> : null}

      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
