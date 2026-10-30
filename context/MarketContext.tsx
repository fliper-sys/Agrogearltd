import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CATEGORY_EMOJI, Equipment, SEED_EQUIPMENT } from '@/lib/data';
import { rentalDays } from '@/lib/format';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export type NewListing = {
  name: string;
  category: string;
  price: number;
  location: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
};
export type NewBooking = { name: string; phone: string; start: string; end: string; note: string };
export type BookingResult = { days: number; total: number };

type MarketState = {
  equipment: Equipment[];
  loading: boolean;
  offline: boolean;
  favourites: Set<number>;
  toggleFavourite: (id: number) => Promise<{ error?: string }>;
  createListing: (input: NewListing) => Promise<{ error?: string }>;
  deleteListing: (id: number) => Promise<{ error?: string }>;
  createBooking: (item: Equipment, input: NewBooking) => Promise<{ error?: string; result?: BookingResult }>;
  refresh: () => Promise<void>;
};

const MarketContext = createContext<MarketState | null>(null);

const NEW_LISTING_COLOR = '#dcecdf';

function fromRow(r: any): Equipment {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    category: r.category,
    price: Number(r.price_per_day),
    location: r.location,
    description: r.description ?? '',
    emoji: r.emoji ?? '🚜',
    badge: r.badge ?? r.category,
    color: r.color ?? '#e8eee4',
    featured: Boolean(r.featured),
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    hidden: Boolean(r.hidden),
  };
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>(SEED_EQUIPMENT);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [favourites, setFavourites] = useState<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setEquipment(SEED_EQUIPMENT);
      setOffline(true);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('equipment').select('*').order('id', { ascending: true });
    if (error || !data) {
      setEquipment(SEED_EQUIPMENT);
      setOffline(true);
    } else {
      setEquipment(data.map(fromRow));
      setOffline(false);
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
      const { data, error } = await supabase
        .from('equipment')
        .insert({
          owner_id: user.id,
          name: input.name,
          category: input.category,
          price_per_day: input.price,
          location: input.location,
          description:
            input.description ||
            'Owner-provided equipment listing. Contact the owner to confirm specifications and availability.',
          emoji: CATEGORY_EMOJI[input.category] ?? '🚜',
          badge: 'New listing',
          color: NEW_LISTING_COLOR,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
        })
        .select()
        .single();
      if (error || !data) return { error: error?.message ?? 'Could not publish your listing.' };
      setEquipment((prev) => [...prev, fromRow(data)]);
      return {};
    },
    [user],
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

  const createBooking = useCallback(
    async (item: Equipment, input: NewBooking) => {
      if (!user) return { error: 'Sign in to request a rental.' };
      if (input.end < input.start) return { error: 'End date must be on or after the start date.' };
      const days = rentalDays(input.start, input.end);
      const total = days * item.price;
      const { error } = await supabase.from('bookings').insert({
        equipment_id: item.id,
        renter_id: user.id,
        renter_name: input.name,
        renter_phone: input.phone,
        start_date: input.start,
        end_date: input.end,
        days,
        estimated_total: total,
        note: input.note || null,
      });
      if (error) return { error: error.message };
      return { result: { days, total } };
    },
    [user],
  );

  const value = useMemo(
    () => ({ equipment, loading, offline, favourites, toggleFavourite, createListing, deleteListing, createBooking, refresh }),
    [equipment, loading, offline, favourites, toggleFavourite, createListing, deleteListing, createBooking, refresh],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used inside MarketProvider');
  return ctx;
}
