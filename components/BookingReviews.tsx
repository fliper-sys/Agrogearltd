import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Booking, useRentals } from '@/context/RentalsContext';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { StarInput, StarRow } from './Reviews';
import { useToast } from './Toast';
import { Button, ErrorText, T, TextField } from './ui';

const box = { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 } as const;

/** Review prompts shown on a completed booking: renter rates the machine/owner, owner rates the renter. */
export function BookingReviews({ booking: b, role }: { booking: Booking; role: 'renter' | 'owner' }) {
  const { review } = useRentals();
  const toast = useToast();
  const [mine, setMine] = useState<{ rating: number; comment: string; created_at: string } | null>(null);
  const [rated, setRated] = useState<{ rating: number; comment: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (b.status !== 'completed') return;
    if (role === 'renter') {
      const { data } = await supabase.from('reviews_feed').select('rating,comment,created_at').eq('booking_id', b.id).maybeSingle();
      setMine((data as any) ?? null);
    } else {
      const { data } = await supabase.from('renter_reviews').select('rating,comment').eq('booking_id', b.id).maybeSingle();
      setRated((data as any) ?? null);
    }
  }, [b.id, b.status, role]);

  useEffect(() => {
    load();
  }, [load, b.reviewed]);

  if (b.status !== 'completed') return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    let err: string | undefined;
    if (role === 'renter') {
      if (mine) {
        const { error: e } = await supabase.rpc('update_review', { p_booking: b.id, p_rating: rating, p_comment: comment.trim() });
        err = e?.message;
      } else {
        err = (await review(b.id, rating, comment.trim())).error;
      }
    } else {
      const { error: e } = await supabase.rpc('rate_renter', { p_booking: b.id, p_rating: rating, p_comment: comment.trim() });
      err = e?.message;
    }
    setBusy(false);
    if (err) return setError(err);
    toast(role === 'renter' ? (mine ? 'Review updated.' : 'Thanks for your review!') : 'Renter rated. Thank you!');
    setEditing(false);
    load();
  };

  const form = (
    <View>
      <StarInput value={rating} onChange={setRating} />
      <View style={{ marginTop: 10 }}>
        <TextField
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={600}
          placeholder={role === 'renter' ? 'Condition of the machine, owner communication, delivery…' : 'Care of the machine, punctuality, communication…'}
        />
        <T style={{ color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 4 }}>{comment.length}/600</T>
      </View>
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Button small label={role === 'renter' ? (mine ? 'Save changes' : 'Submit review') : 'Submit rating'} onPress={submit} loading={busy} />
        {editing ? <Button small variant="secondary" label="Cancel" onPress={() => setEditing(false)} /> : null}
      </View>
    </View>
  );

  if (role === 'renter') {
    if (!mine) {
      return (
        <View style={box}>
          <T style={{ fontWeight: '800', marginBottom: 8 }}>How was this rental?</T>
          {form}
        </View>
      );
    }
    const canEdit = Date.now() - new Date(mine.created_at).getTime() < 14 * 86400000;
    return (
      <View style={box}>
        <T style={{ fontWeight: '800', marginBottom: 6 }}>Your review</T>
        {editing ? (
          form
        ) : (
          <View style={{ gap: 6 }}>
            <StarRow rating={mine.rating} size={18} />
            {mine.comment ? <T style={{ lineHeight: 21 }}>{mine.comment}</T> : null}
            {canEdit ? (
              <Button
                small
                variant="secondary"
                label="Edit review"
                onPress={() => {
                  setRating(mine.rating);
                  setComment(mine.comment);
                  setEditing(true);
                }}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
              />
            ) : null}
          </View>
        )}
      </View>
    );
  }

  // owner
  return (
    <View style={box}>
      <T style={{ fontWeight: '800', marginBottom: 8 }}>{rated ? 'Your rating of the renter' : 'Rate this renter'}</T>
      {rated ? (
        <View style={{ gap: 6 }}>
          <StarRow rating={rated.rating} size={18} />
          {rated.comment ? <T style={{ lineHeight: 21 }}>{rated.comment}</T> : null}
        </View>
      ) : (
        form
      )}
    </View>
  );
}
