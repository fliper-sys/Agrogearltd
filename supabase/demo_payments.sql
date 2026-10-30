-- DEMO ONLY. Lets a renter "pay" without a payment provider so you can test the full flow.
-- Do NOT run this in production: it lets anyone mark their own booking as paid.
-- Pair it with EXPO_PUBLIC_DEMO_PAYMENTS=true in your environment.
create or replace function public.demo_pay_booking(p_booking bigint)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking and renter_id = auth.uid();
  if b.id is null then raise exception 'Booking not found.'; end if;
  return public.record_payment(p_booking, 'demo', 'DEMO-' || p_booking || '-' || extract(epoch from now())::bigint, b.grand_total);
end $$;
grant execute on function public.demo_pay_booking(bigint) to authenticated;
