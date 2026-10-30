import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { payForBooking } from '@/lib/payments';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { useMarket } from './MarketContext';

export type BookingStatus =
  | 'pending' | 'approved' | 'paid' | 'dispatched' | 'active' | 'returned' | 'completed'
  | 'declined' | 'cancelled' | 'disputed';

export type Booking = {
  id: number;
  equipmentId: number;
  renterId: string;
  renterName: string;
  renterPhone: string;
  startDate: string;
  endDate: string;
  days: number;
  rentalTotal: number;
  deliveryFee: number;
  deposit: number;
  serviceFee: number;
  grandTotal: number;
  fulfilment: 'pickup' | 'delivery';
  deliveryAddress: string | null;
  note: string | null;
  status: BookingStatus;
  paymentStatus: 'unpaid' | 'held' | 'released' | 'refunded';
  paymentReference: string | null;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  rentalEndsAt: string | null;
  returnedAt: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  disputeReason: string | null;
  handoverNote: string | null;
  returnNote: string | null;
  reviewed: boolean;
};

export type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  bookingId: number | null;
  read: boolean;
  createdAt: string;
};

export type NewBooking = {
  name: string;
  phone: string;
  start: string;
  end: string;
  note: string;
  fulfilment: 'pickup' | 'delivery';
  address: string;
};

export type Action = 'approve' | 'decline' | 'cancel' | 'dispatch' | 'confirm_received' | 'return' | 'complete' | 'dispute';

type Result = { error?: string };

type RentalsState = {
  asRenter: Booking[];
  asOwner: Booking[];
  notifications: Notification[];
  unread: number;
  actionNeeded: number;
  loading: boolean;
  createBooking: (equipmentId: number, input: NewBooking) => Promise<Result & { booking?: Booking }>;
  act: (bookingId: number, action: Action, note?: string) => Promise<Result>;
  pay: (booking: Booking) => Promise<Result & { cancelled?: boolean }>;
  review: (bookingId: number, rating: number, comment: string) => Promise<Result>;
  ownerContact: (bookingId: number) => Promise<{ name: string; phone: string } | null>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
};

const RentalsContext = createContext<RentalsState | null>(null);

function fromRow(r: any, reviewed: Set<number>): Booking {
  return {
    id: r.id,
    equipmentId: r.equipment_id,
    renterId: r.renter_id,
    renterName: r.renter_name,
    renterPhone: r.renter_phone,
    startDate: r.start_date,
    endDate: r.end_date,
    days: r.days,
    rentalTotal: Number(r.rental_total || r.estimated_total || 0),
    deliveryFee: Number(r.delivery_fee ?? 0),
    deposit: Number(r.deposit ?? 0),
    serviceFee: Number(r.service_fee ?? 0),
    grandTotal: Number(r.grand_total || r.estimated_total || 0),
    fulfilment: r.fulfilment ?? 'pickup',
    deliveryAddress: r.delivery_address ?? null,
    note: r.note ?? null,
    status: r.status,
    paymentStatus: r.payment_status ?? 'unpaid',
    paymentReference: r.payment_reference ?? null,
    createdAt: r.created_at,
    approvedAt: r.approved_at ?? null,
    paidAt: r.paid_at ?? null,
    dispatchedAt: r.dispatched_at ?? null,
    deliveredAt: r.delivered_at ?? null,
    rentalEndsAt: r.rental_ends_at ?? null,
    returnedAt: r.returned_at ?? null,
    completedAt: r.completed_at ?? null,
    cancelReason: r.cancel_reason ?? null,
    disputeReason: r.dispute_reason ?? null,
    handoverNote: r.handover_note ?? null,
    returnNote: r.return_note ?? null,
    reviewed: reviewed.has(r.id),
  };
}

export function RentalsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { equipment, refresh: refreshMarket } = useMarket();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const equipmentRef = useRef(equipment);
  equipmentRef.current = equipment;

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setBookings([]);
      setNotifications([]);
      return;
    }
    setLoading(true);
    const [b, n, rv] = await Promise.all([
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(40),
      supabase.from('reviews').select('booking_id').eq('reviewer_id', user.id),
    ]);
    const reviewed = new Set<number>((rv.data ?? []).map((r: any) => Number(r.booking_id)));
    if (b.data) setBookings(b.data.map((r: any) => fromRow(r, reviewed)));
    if (n.data) {
      setNotifications(
        n.data.map((r: any) => ({
          id: r.id,
          kind: r.kind,
          title: r.title,
          body: r.body,
          bookingId: r.booking_id ?? null,
          read: Boolean(r.read_at),
          createdAt: r.created_at,
        })),
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Light polling keeps both sides in sync (owner approves -> renter sees "Pay now") without extra infrastructure.
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [user, refresh]);

  const ownedIds = useMemo(
    () => new Set(equipment.filter((e) => user && e.ownerId === user.id).map((e) => e.id)),
    [equipment, user],
  );

  const asRenter = useMemo(() => bookings.filter((b) => user && b.renterId === user.id), [bookings, user]);
  const asOwner = useMemo(() => bookings.filter((b) => ownedIds.has(b.equipmentId)), [bookings, ownedIds]);

  const actionNeeded = useMemo(() => {
    const renterNeeds = asRenter.filter((b) => b.status === 'approved' || b.status === 'dispatched' || (b.status === 'completed' && !b.reviewed)).length;
    const ownerNeeds = asOwner.filter((b) => ['pending', 'paid', 'returned'].includes(b.status)).length;
    return renterNeeds + ownerNeeds;
  }, [asRenter, asOwner]);

  const createBooking = useCallback(
    async (equipmentId: number, input: NewBooking) => {
      if (!user) return { error: 'Sign in to request a rental.' };
      const { data, error } = await supabase.rpc('create_booking', {
        p_equipment: equipmentId,
        p_start: input.start,
        p_end: input.end,
        p_name: input.name,
        p_phone: input.phone,
        p_note: input.note,
        p_fulfilment: input.fulfilment,
        p_address: input.fulfilment === 'delivery' ? input.address : null,
      });
      if (error) return { error: error.message };
      await Promise.all([refresh(), refreshMarket()]);
      return { booking: fromRow(data, new Set()) };
    },
    [user, refresh, refreshMarket],
  );

  const act = useCallback(
    async (bookingId: number, action: Action, note?: string) => {
      const { error } = await supabase.rpc('advance_booking', { p_booking: bookingId, p_action: action, p_note: note ?? null });
      if (error) return { error: error.message };
      await Promise.all([refresh(), refreshMarket()]);
      return {};
    },
    [refresh, refreshMarket],
  );

  const pay = useCallback(
    async (booking: Booking) => {
      if (!user?.email) return { error: 'Your account needs an email address to pay.' };
      const res = await payForBooking({ bookingId: booking.id, amountNaira: booking.grandTotal, email: user.email });
      if (res.ok) {
        await Promise.all([refresh(), refreshMarket()]);
        return {};
      }
      return { error: res.error, cancelled: res.cancelled };
    },
    [user, refresh, refreshMarket],
  );

  const review = useCallback(
    async (bookingId: number, rating: number, comment: string) => {
      const { error } = await supabase.rpc('submit_review', { p_booking: bookingId, p_rating: rating, p_comment: comment });
      if (error) return { error: error.message };
      await Promise.all([refresh(), refreshMarket()]);
      return {};
    },
    [refresh, refreshMarket],
  );

  const ownerContact = useCallback(async (bookingId: number) => {
    const { data } = await supabase.rpc('owner_contact', { p_booking: bookingId });
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { name: row.owner_name as string, phone: row.owner_phone as string } : null;
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null);
  }, [user]);

  const unread = notifications.filter((n) => !n.read).length;

  const value = useMemo(
    () => ({ asRenter, asOwner, notifications, unread, actionNeeded, loading, createBooking, act, pay, review, ownerContact, markAllRead, refresh }),
    [asRenter, asOwner, notifications, unread, actionNeeded, loading, createBooking, act, pay, review, ownerContact, markAllRead, refresh],
  );

  return <RentalsContext.Provider value={value}>{children}</RentalsContext.Provider>;
}

export function useRentals() {
  const ctx = useContext(RentalsContext);
  if (!ctx) throw new Error('useRentals must be used inside RentalsProvider');
  return ctx;
}
