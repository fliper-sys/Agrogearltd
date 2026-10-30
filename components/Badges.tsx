import React from 'react';
import { View } from 'react-native';
import type { BookingStatus } from '@/context/RentalsContext';
import { colors } from '@/lib/theme';
import { T } from './ui';

export function VerifiedBadge({ small }: { small?: boolean }) {
  return (
    <View
      accessibilityLabel="Verified owner"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#e3f3e9',
        borderRadius: 99,
        paddingVertical: small ? 2 : 4,
        paddingHorizontal: small ? 7 : 10,
        alignSelf: 'flex-start',
      }}
    >
      <T style={{ color: colors.available, fontSize: small ? 10 : 12, fontWeight: '800' }}>✓ Verified</T>
    </View>
  );
}

export function Stars({ rating, count, size = 12 }: { rating: number; count?: number; size?: number }) {
  if (!count) return <T style={{ fontSize: size, color: colors.muted }}>No reviews yet</T>;
  return (
    <T style={{ fontSize: size, color: colors.muted }}>
      <T style={{ color: '#d79b2d', fontSize: size, fontWeight: '800' }}>★ {rating.toFixed(1)}</T> ({count})
    </T>
  );
}

const STATUS: Record<BookingStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Awaiting owner', bg: '#fdf3d9', fg: '#8a6414' },
  approved: { label: 'Approved · pay now', bg: '#e2eefb', fg: '#25589a' },
  paid: { label: 'Paid · awaiting dispatch', bg: '#e3f3e9', fg: colors.available },
  dispatched: { label: 'On the way', bg: '#e2eefb', fg: '#25589a' },
  active: { label: 'In use', bg: '#dcefe2', fg: colors.green },
  returned: { label: 'Returned · inspecting', bg: '#fdf3d9', fg: '#8a6414' },
  completed: { label: 'Completed', bg: '#ececec', fg: '#555' },
  declined: { label: 'Declined', bg: colors.errorBg, fg: colors.error },
  cancelled: { label: 'Cancelled', bg: colors.errorBg, fg: colors.error },
  disputed: { label: 'Dispute open', bg: colors.errorBg, fg: colors.error },
};

export function StatusPill({ status }: { status: BookingStatus }) {
  const s = STATUS[status];
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start' }}>
      <T style={{ color: s.fg, fontSize: 11, fontWeight: '800' }}>{s.label}</T>
    </View>
  );
}
