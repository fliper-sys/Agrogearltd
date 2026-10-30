import { rentalDays } from './format';
import type { Equipment } from './data';

/** Must match public.service_fee_rate() in supabase/migrations/002_v2_upgrade.sql. 0 = no platform fee. */
export const SERVICE_FEE_RATE = 0;

export type Quote = {
  days: number;
  rental: number;
  delivery: number;
  serviceFee: number;
  deposit: number;
  total: number;
};

/** Client-side preview only. The database recomputes the real price when the request is created. */
export function quote(item: Equipment, start: string, end: string, fulfilment: 'pickup' | 'delivery'): Quote | null {
  if (!start || !end || end < start) return null;
  const days = rentalDays(start, end);
  const rental = days * item.price;
  const delivery = fulfilment === 'delivery' ? item.deliveryFee : 0;
  const serviceFee = Math.round(rental * SERVICE_FEE_RATE * 100) / 100;
  return { days, rental, delivery, serviceFee, deposit: item.deposit, total: rental + delivery + serviceFee + item.deposit };
}
