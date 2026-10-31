import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';

export type ReviewRow = {
  id: number;
  booking_id: number;
  equipment_id: number;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  edited_at: string | null;
  owner_reply: string | null;
  owner_reply_at: string | null;
  equipment_name: string;
  equipment_emoji: string;
  owner_id: string | null;
  reviewer_name: string;
  reviewer_avatar: string | null;
  reviewer_verified: boolean;
};

export type RenterReviewRow = {
  id: number;
  booking_id: number;
  renter_id: string;
  owner_id: string;
  rating: number;
  comment: string;
  created_at: string;
  owner_name: string;
  owner_avatar: string | null;
};

export const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Reviews for one machine (`equipmentId`) or everything an owner has received (`ownerId`). */
export function useReviews(filter: { equipmentId?: number; ownerId?: string | null }) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const key = `${filter.equipmentId ?? ''}|${filter.ownerId ?? ''}`;

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || (!filter.equipmentId && !filter.ownerId)) {
      setRows([]);
      setLoading(false);
      return;
    }
    let q = supabase.from('reviews_feed').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter.equipmentId) q = q.eq('equipment_id', filter.equipmentId);
    else if (filter.ownerId) q = q.eq('owner_id', filter.ownerId);
    const { data } = await q;
    setRows((data as ReviewRow[]) ?? []);
    setLoading(false);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return { rows, loading, reload: load };
}

export function useRenterReviews(renterId: string | null | undefined) {
  const [rows, setRows] = useState<RenterReviewRow[]>([]);
  useEffect(() => {
    if (!renterId || !isSupabaseConfigured) return setRows([]);
    supabase
      .from('renter_reviews_feed')
      .select('*')
      .eq('renter_id', renterId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data as RenterReviewRow[]) ?? []));
  }, [renterId]);
  return rows;
}

export type ProfileStats = {
  listings: number;
  owner_rating: number;
  owner_reviews: number;
  renter_rating: number;
  renter_reviews: number;
  completed_as_owner: number;
  completed_as_renter: number;
};

export function useProfileStats(userId: string | null | undefined) {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return setStats(null);
    supabase.rpc('profile_stats', { p_user: userId }).then(({ data }) => setStats((data as ProfileStats) ?? null));
  }, [userId]);
  return stats;
}
