import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CATEGORY_EMOJI, EQUIPMENT_DEFAULTS, Equipment, SEED_EQUIPMENT } from '@/lib/data';
import { publicImageUrl } from '@/lib/files';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export type NewListing = {
  name: string;
  category: string;
  price: number;
  location: string;
  state: string;
  description: string;
  condition: string;
  yearMade: number | null;
  specs: string;
  deposit: number;
  minDays: number;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  deliveryFee: number;
  withOperator: boolean;
  images: string[]; // storage paths in the equipment-images bucket
};

export type BookedRange = { equipmentId: number; start: string; end: string };

type MarketState = {
  equipment: Equipment[];
  loading: boolean;
  offline: boolean;
  favourites: Set<number>;
  bookedRanges: BookedRange[];
  toggleFavourite: (id: number) => Promise<{ error?: string }>;
  createListing: (input: NewListing) => Promise<{ error?: string }>;
  deleteListing: (id: number) => Promise<{ error?: string }>;
  refresh: () => Promise<void>;
};

const MarketContext = createContext<MarketState | null>(null);

const NEW_LISTING_COLOR = '#dcecdf';

function fromRow(r: any): Equipment {
  return {
    ...EQUIPMENT_DEFAULTS,
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    category: r.category,
    price: Number(r.price_per_day),
    location: r.location,
    state: r.state ?? '',
    description: r.description ?? '',
    emoji: r.emoji ?? '🚜',
    badge: r.badge ?? r.category,
    color: r.color ?? '#e8eee4',
    featured: Boolean(r.featured),
    condition: r.condition ?? 'Good',
    yearMade: r.year_made ?? null,
    specs: r.specs ?? '',
    deposit: Number(r.deposit ?? 0),
    minDays: Number(r.min_days ?? 1),
    pickupAvailable: r.pickup_available ?? true,
    deliveryAvailable: Boolean(r.delivery_available),
    deliveryFee: Number(r.delivery_fee ?? 0),
    withOperator: Boolean(r.with_operator),
    images: Array.isArray(r.images) ? r.images.map(publicImageUrl) : [],
    ownerName: r.owner_name ?? '',
    ownerVerified: Boolean(r.owner_verified),
    avgRating: Number(r.avg_rating ?? 0),
    reviewCount: Number(r.review_count ?? 0),
    createdAt: r.created_at ?? '',
  };
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>(SEED_EQUIPMENT);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [favourites, setFavourites] = useState<Set<number>>(new Set());
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setEquipment(SEED_EQUIPMENT);
      setOffline(true);
      setLoading(false);
      return;
    }
    // Prefer the v2 feed (owner trust data + ratings); fall back to the plain table if the migration has not run yet.
    let { data, error } = await supabase.from('equipment_feed').select('*').order('id', { ascending: true });
    if (error) ({ data, error } = await supabase.from('equipment').select('*').order('id', { ascending: true }));
    if (error || !data) {
      setEquipment(SEED_EQUIPMENT);
      setOffline(true);
    } else {
      setEquipment(data.map(fromRow));
      setOffline(false);
    }
    const ranges = await supabase.from('booked_ranges').select('equipment_id,start_date,end_date');
    if (!ranges.error && ranges.data) {
      setBookedRanges(ranges.data.map((r: any) => ({ equipmentId: Number(r.equipment_id), start: r.start_date, end: r.end_date })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setFavourites(new Set());
      return;
    }
    let active = true;
    supabase
      .from('favourites')
      .select('equipment_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (active && data) setFavourites(new Set(data.map((r: any) => Number(r.equipment_id))));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const toggleFavourite = useCallback(
    async (id: number) => {
      if (!user) return { error: 'Sign in to save favourites.' };
      const had = favourites.has(id);
      setFavourites((prev) => {
        const next = new Set(prev);
        had ? next.delete(id) : next.add(id);
        return next;
      });
      const { error } = had
        ? await supabase.from('favourites').delete().eq('user_id', user.id).eq('equipment_id', id)
        : await supabase.from('favourites').insert({ user_id: user.id, equipment_id: id });
      if (error) {
        setFavourites((prev) => {
          const next = new Set(prev);
          had ? next.add(id) : next.delete(id);
          return next;
        });
        return { error: 'Could not update favourites. Please try again.' };
      }
      return {};
    },
    [user, favourites],
  );

  const createListing = useCallback(
    async (input: NewListing) => {
      if (!user) return { error: 'Sign in to list your equipment.' };
      const { error } = await supabase.from('equipment').insert({
        owner_id: user.id,
        name: input.name,
        category: input.category,
        price_per_day: input.price,
        location: input.location,
        state: input.state,
        description:
          input.description ||
          'Owner-provided equipment listing. Contact the owner to confirm specifications and availability.',
        emoji: CATEGORY_EMOJI[input.category] ?? '🚜',
        badge: 'New listing',
        color: NEW_LISTING_COLOR,
        condition: input.condition,
        year_made: input.yearMade,
        specs: input.specs,
        deposit: input.deposit,
        min_days: input.minDays,
        pickup_available: input.pickupAvailable,
        delivery_available: input.deliveryAvailable,
        delivery_fee: input.deliveryAvailable ? input.deliveryFee : 0,
        with_operator: input.withOperator,
        images: input.images,
      });
      if (error) return { error: error.message };
      await refresh();
      return {};
    },
    [user, refresh],
  );

  const deleteListing = useCallback(
    async (id: number) => {
      if (!user) return { error: 'Sign in first.' };
      const { error } = await supabase.from('equipment').delete().eq('id', id).eq('owner_id', user.id);
      if (error) return { error: error.message };
      setEquipment((prev) => prev.filter((e) => e.id !== id));
      setFavourites((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return {};
    },
    [user],
  );

  const value = useMemo(
    () => ({ equipment, loading, offline, favourites, bookedRanges, toggleFavourite, createListing, deleteListing, refresh }),
    [equipment, loading, offline, favourites, bookedRanges, toggleFavourite, createListing, deleteListing, refresh],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used inside MarketProvider');
  return ctx;
}
