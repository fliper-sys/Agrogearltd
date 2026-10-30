import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from './supabase';

const PAYSTACK_KEY = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY;

export const paystackEnabled = Boolean(PAYSTACK_KEY);
/** Demo mode lets you test the whole flow without a payment provider. Never enable in production. */
export const demoPaymentsEnabled = process.env.EXPO_PUBLIC_DEMO_PAYMENTS === 'true';

export type PayResult = { ok: boolean; error?: string; cancelled?: boolean };

let scriptPromise: Promise<void> | null = null;
function loadPaystack(): Promise<void> {
  if ((window as any).PaystackPop) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.paystack.co/v1/inline.js';
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load the payment window. Check your connection.'));
      };
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Charge the renter and have the server confirm it.
 * 1. Paystack inline popup collects the card / transfer / USSD payment (amount in kobo).
 * 2. The `verify-payment` edge function asks Paystack whether the reference really succeeded for the right
 *    amount, then calls public.record_payment with the service role. The client can never mark itself paid.
 */
export async function payForBooking(opts: { bookingId: number; amountNaira: number; email: string }): Promise<PayResult> {
  if (!isSupabaseConfigured) return { ok: false, error: 'The app is not connected to its database yet.' };

  if (demoPaymentsEnabled) {
    const { error } = await supabase.rpc('demo_pay_booking', { p_booking: opts.bookingId });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  if (!PAYSTACK_KEY) return { ok: false, error: 'Online payment is not set up yet. Please contact AgroGear support.' };
  if (Platform.OS !== 'web') return { ok: false, error: 'Please complete payment from the AgroGear website.' };

  try {
    await loadPaystack();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }

  const reference = `AG-${opts.bookingId}-${Date.now()}`;
  const popped = await new Promise<{ ref?: string; cancelled?: boolean }>((resolve) => {
    const handler = (window as any).PaystackPop.setup({
      key: PAYSTACK_KEY,
      email: opts.email,
      amount: Math.round(opts.amountNaira * 100),
      currency: 'NGN',
      ref: reference,
      metadata: { booking_id: opts.bookingId },
      callback: (r: any) => resolve({ ref: r.reference }),
      onClose: () => resolve({ cancelled: true }),
    });
    handler.openIframe();
  });
  if (popped.cancelled || !popped.ref) return { ok: false, cancelled: true };

  const { data, error } = await supabase.functions.invoke('verify-payment', {
    body: { booking_id: opts.bookingId, reference: popped.ref },
  });
  if (error || !data?.ok) {
    return { ok: false, error: data?.error ?? error?.message ?? 'We could not confirm your payment yet. If you were charged, it will be matched shortly.' };
  }
  return { ok: true };
}
