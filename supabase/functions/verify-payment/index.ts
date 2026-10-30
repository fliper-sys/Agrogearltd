// Supabase Edge Function: confirms a Paystack charge server-side, then marks the booking paid.
// Deploy:  supabase functions deploy verify-payment
// Secrets: supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...   (never put this in the app)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secret) return json({ ok: false, error: 'Payments are not configured.' }, 500);

    // Who is calling?
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ ok: false, error: 'Sign in first.' }, 401);

    const { booking_id, reference } = await req.json();
    const admin = createClient(url, service);

    const { data: booking } = await admin.from('bookings').select('*').eq('id', booking_id).single();
    if (!booking || booking.renter_id !== u.user.id) return json({ ok: false, error: 'Booking not found.' }, 404);
    if (booking.status !== 'approved') return json({ ok: false, error: 'Booking is not awaiting payment.' }, 409);

    // Ask Paystack whether this reference really succeeded, and for how much.
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.json();
    if (!body.status || body.data?.status !== 'success') return json({ ok: false, error: 'Payment was not successful.' }, 402);
    if (body.data.currency !== 'NGN') return json({ ok: false, error: 'Unexpected currency.' }, 402);
    if (Number(body.data.metadata?.booking_id) !== Number(booking_id)) return json({ ok: false, error: 'Payment does not match this booking.' }, 402);

    const paid = Number(body.data.amount) / 100;
    const { error } = await admin.rpc('record_payment', {
      p_booking: booking_id, p_provider: 'paystack', p_reference: reference, p_amount: paid,
    });
    if (error) return json({ ok: false, error: error.message }, 400);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
