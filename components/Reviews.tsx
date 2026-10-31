import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { RATING_LABELS, ReviewRow, useReviews } from '@/lib/reviews';
import { supabase } from '@/lib/supabase';
import { colors, web } from '@/lib/theme';
import { timeAgo } from '@/lib/geo';
import { Avatar } from './Avatar';
import { VerifiedBadge } from './Badges';
import { useToast } from './Toast';
import { Button, ErrorText, T, TextField } from './ui';

const GOLD = '#d79b2d';

/** Read-only row of stars (supports halves via rounding). */
export function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <T style={{ fontSize: size, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <T key={n} style={{ color: n <= Math.round(rating) ? GOLD : '#d6d9d0', fontSize: size }}>★</T>
      ))}
    </T>
  );
}

/** Tappable stars with a word label (Poor … Excellent). */
export function StarInput({ value, onChange, size = 32 }: { value: number; onChange: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} onPress={() => onChange(n)} style={web({ cursor: 'pointer' })}>
          <T style={{ fontSize: size, color: n <= value ? GOLD : '#d6d9d0' }}>★</T>
        </Pressable>
      ))}
      <T style={{ color: colors.muted, fontWeight: '700', fontSize: 13, marginLeft: 6 }}>{RATING_LABELS[value] ?? ''}</T>
    </View>
  );
}

/** Average score with a 5-to-1 star distribution. */
export function RatingSummary({ rows }: { rows: { rating: number }[] }) {
  const stats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    rows.forEach((r) => (counts[r.rating] += 1));
    const total = rows.length;
    const avg = total ? rows.reduce((a, r) => a + r.rating, 0) / total : 0;
    return { counts, total, avg };
  }, [rows]);
  if (!stats.total) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
      <View style={{ alignItems: 'center', minWidth: 90 }}>
        <T style={{ fontSize: 40, fontWeight: '800', color: colors.green, letterSpacing: -1.5 }}>{stats.avg.toFixed(1)}</T>
        <StarRow rating={stats.avg} size={15} />
        <T style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{stats.total} review{stats.total === 1 ? '' : 's'}</T>
      </View>
      <View style={{ flex: 1, minWidth: 180, gap: 5 }}>
        {[5, 4, 3, 2, 1].map((n) => (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T style={{ fontSize: 12, width: 14, color: colors.muted }}>{n}</T>
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: '#ecefe6', overflow: 'hidden' }}>
              <View style={{ width: `${(stats.counts[n] / stats.total) * 100}%`, height: 8, backgroundColor: GOLD }} />
            </View>
            <T style={{ fontSize: 12, width: 22, color: colors.muted, textAlign: 'right' }}>{stats.counts[n]}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ReviewCard({ r, showEquipment, onChanged }: { r: ReviewRow; showEquipment?: boolean; onChanged?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const isOwner = Boolean(user && r.owner_id === user.id);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.owner_reply ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendReply = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc('reply_to_review', { p_review: r.id, p_reply: reply });
    setBusy(false);
    if (e) return setError(e.message);
    toast('Reply posted.');
    setReplying(false);
    onChanged?.();
  };

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.push(`/u/${r.reviewer_id}`)} style={web({ cursor: 'pointer' })}>
          <Avatar url={r.reviewer_avatar} name={r.reviewer_name} size={36} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <T style={{ fontWeight: '800', fontSize: 14 }}>{r.reviewer_name}</T>
            {r.reviewer_verified ? <VerifiedBadge small /> : null}
          </View>
          <T style={{ color: colors.muted, fontSize: 12 }}>
            {timeAgo(r.created_at)}{r.edited_at ? ' · edited' : ''}
          </T>
        </View>
        <StarRow rating={r.rating} size={15} />
      </View>
      {showEquipment ? <T style={{ color: colors.muted, fontSize: 12 }}>{r.equipment_emoji} {r.equipment_name}</T> : null}
      {r.comment ? <T style={{ lineHeight: 22, fontSize: 14 }}>{r.comment}</T> : <T style={{ color: colors.muted, fontSize: 13, fontStyle: 'italic' }}>No written comment.</T>}

      {r.owner_reply && !replying ? (
        <View style={{ backgroundColor: colors.cream, borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: colors.green }}>
          <T style={{ fontWeight: '800', fontSize: 12, color: colors.green }}>Reply from the owner</T>
          <T style={{ lineHeight: 21, fontSize: 13, marginTop: 4 }}>{r.owner_reply}</T>
        </View>
      ) : null}

      {isOwner && !replying ? (
        <Pressable onPress={() => setReplying(true)} style={web({ cursor: 'pointer' })}>
          <T style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>{r.owner_reply ? 'Edit reply' : '↩ Reply publicly'}</T>
        </Pressable>
      ) : null}
      {replying ? (
        <View style={{ gap: 8 }}>
          <TextField value={reply} onChangeText={setReply} multiline placeholder="Thank the renter or clarify what happened…" maxLength={600} />
          <ErrorText>{error}</ErrorText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small label="Post reply" onPress={sendReply} loading={busy} />
            <Button small variant="secondary" label="Cancel" onPress={() => setReplying(false)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Summary + list of reviews for a machine or for everything an owner has received. */
export function ReviewList({ equipmentId, ownerId, showEquipment, limit }: { equipmentId?: number; ownerId?: string | null; showEquipment?: boolean; limit?: number }) {
  const { rows, loading, reload } = useReviews({ equipmentId, ownerId });
  const [all, setAll] = useState(false);
  if (loading) return null;
  if (!rows.length) return <T style={{ color: colors.muted, fontSize: 13 }}>No reviews yet. Reviews appear after a completed rental.</T>;
  const shown = limit && !all ? rows.slice(0, limit) : rows;
  return (
    <View style={{ gap: 12 }}>
      <RatingSummary rows={rows} />
      {shown.map((r) => (
        <ReviewCard key={r.id} r={r} showEquipment={showEquipment} onChanged={reload} />
      ))}
      {limit && rows.length > limit ? (
        <Button small variant="secondary" label={all ? 'Show fewer' : `Show all ${rows.length} reviews`} onPress={() => setAll((a) => !a)} style={{ alignSelf: 'flex-start' }} />
      ) : null}
    </View>
  );
}
