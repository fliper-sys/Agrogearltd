import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookingCard } from '@/components/BookingCard';
import { Card, PageShell } from '@/components/PageShell';
import { Button, Chip, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { Booking, useRentals } from '@/context/RentalsContext';
import { colors, web } from '@/lib/theme';
import { timeAgo } from '@/lib/time';

type Tab = 'renting' | 'owning';
const ACTIVE = ['pending', 'approved', 'paid', 'dispatched', 'active', 'returned', 'disputed'];

export default function Rentals() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { asRenter, asOwner, notifications, unread, loading, markAllRead, refresh } = useRentals();
  const [tab, setTab] = useState<Tab>('renting');
  const [showHistory, setShowHistory] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Owners land on their requests tab if they have anything waiting.
  useEffect(() => {
    if (asRenter.length === 0 && asOwner.length > 0) setTab('owning');
  }, [asRenter.length, asOwner.length]);

  const list: Booking[] = tab === 'renting' ? asRenter : asOwner;
  const current = useMemo(() => list.filter((b) => ACTIVE.includes(b.status)), [list]);
  const history = useMemo(() => list.filter((b) => !ACTIVE.includes(b.status)), [list]);

  return (
    <PageShell
      title="My rentals"
      subtitle="Track every booking from request to payment, delivery, countdown and return."
      right={<Button variant="secondary" small label="↻ Refresh" onPress={refresh} loading={loading} />}
    >
      {notifications.length ? (
        <Card style={{ padding: 16 }}>
          <Pressable
            onPress={() => {
              setShowNotes((s) => !s);
              if (!showNotes && unread) markAllRead();
            }}
            style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, web({ cursor: 'pointer' })]}
          >
            <T style={{ fontWeight: '800' }}>🔔 Updates{unread ? ` (${unread} new)` : ''}</T>
            <T style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>{showNotes ? 'Hide' : 'Show'}</T>
          </Pressable>
          {showNotes
            ? notifications.slice(0, 12).map((n) => (
                <View key={n.id} style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }}>
                  <T style={{ fontWeight: '700', fontSize: 14 }}>{n.title}</T>
                  <T style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{n.body}</T>
                  <T style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{timeAgo(n.createdAt)}</T>
                </View>
              ))
            : null}
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 9, marginBottom: 18, flexWrap: 'wrap' }}>
        <Chip label={`Renting (${asRenter.length})`} active={tab === 'renting'} onPress={() => setTab('renting')} />
        <Chip label={`Requests for my equipment (${asOwner.length})`} active={tab === 'owning'} onPress={() => setTab('owning')} />
      </View>

      {current.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
          <T style={{ fontSize: 34 }}>{tab === 'renting' ? '🚜' : '📋'}</T>
          <T style={{ fontWeight: '800', fontSize: 17, marginTop: 10 }}>{tab === 'renting' ? 'No active rentals' : 'No requests right now'}</T>
          <T style={{ color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 22 }}>
            {tab === 'renting' ? 'Find a machine in the marketplace and send a booking request.' : 'When a farmer requests one of your machines it will show up here.'}
          </T>
          <Button label="Browse marketplace →" onPress={() => router.replace('/')} style={{ marginTop: 16 }} />
        </Card>
      ) : (
        current.map((b) => <BookingCard key={`${tab}-${b.id}`} booking={b} role={tab === 'renting' ? 'renter' : 'owner'} />)
      )}

      {history.length ? (
        <View style={{ marginTop: 6 }}>
          <Button variant="secondary" label={showHistory ? 'Hide history' : `Show history (${history.length})`} onPress={() => setShowHistory((s) => !s)} style={{ alignSelf: 'flex-start', marginBottom: 14 }} />
          {showHistory ? history.map((b) => <BookingCard key={`h-${tab}-${b.id}`} booking={b} role={tab === 'renting' ? 'renter' : 'owner'} />) : null}
        </View>
      ) : null}
    </PageShell>
  );
}
