# AgroGear 🚜🌱

Agricultural equipment marketplace for African farmers: browse, rent and list machinery.
Built with Expo (React Native Web + expo-router), Supabase (auth + Postgres) and deployed on Vercel.

## Setup

1. **Database** — open Supabase → SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql).
   It creates `equipment`, `favourites` and `bookings` with row-level security, and seeds 8 showcase listings.
2. **Auth** — Supabase → Authentication → URL Configuration: set **Site URL** to your Vercel domain and add it
   (plus `http://localhost:8081`) to **Redirect URLs**. Email confirmation can stay on.
3. **Environment** — copy `.env.example` to `.env`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable / anon key>
   ```

   Only the **publishable (anon)** key belongs in this app. Never add the `service_role` / secret key or the
   database password to client code or to `EXPO_PUBLIC_*` variables.
4. **Run locally**

   ```
   npm install
   npm run web
   ```

## Deploy to Vercel

Import the GitHub repo in Vercel. `vercel.json` already sets the build (`npx expo export --platform web`),
the `dist` output directory and an SPA rewrite. Add the two `EXPO_PUBLIC_SUPABASE_*` variables under
Project Settings → Environment Variables, then deploy. Redeploy after changing them (they are inlined at build time).

## Structure

- `app/` — routes: marketplace (`index`), `auth`, `reset-password`, HTML shell (`+html`)
- `components/` — header, hero, equipment cards, details/booking modal, listing form, footer, UI kit
- `context/` — `AuthContext` (Supabase auth), `MarketContext` (equipment, favourites, bookings)
- `lib/` — theme tokens (palette + breakpoints), seed data, Supabase client
- `supabase/schema.sql` — tables, RLS policies, seed data


## v2 upgrade: verified profiles, smarter search, full rental flow

### One-time setup
1. Run `supabase/migrations/002_v2_upgrade.sql` in Supabase → SQL Editor (after `schema.sql`). Safe to re-run.
2. Make yourself an admin: `update public.profiles set is_admin = true where id = '<your user uuid>';`
3. **Payments**
   - *Testing:* run `supabase/demo_payments.sql` and set `EXPO_PUBLIC_DEMO_PAYMENTS=true`.
   - *Production:* set `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY`, then deploy the edge function:
     `supabase functions deploy verify-payment` and `supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...`.
     Do **not** run `demo_payments.sql` in production.
4. Redeploy on Vercel after changing env vars.

### Rental lifecycle
`pending` → owner approves → `approved` → renter pays (held) → `paid` → owner dispatches → `dispatched` →
renter confirms receipt → `active` (**countdown starts**) → renter marks returned → `returned` → owner confirms → `completed`
(deposit released, review unlocked). Any side can open a dispute once the machine is dispatched.
All transitions, prices and double-booking checks are enforced in Postgres (`create_booking`, `advance_booking`);
the app cannot skip steps or change prices.

### New screens
`/profile` (details, verification, notifications, listings) · `/rentals` (renter and owner views, countdown, updates) · `/admin` (ID review queue).

### Not included yet
Real money payouts to owners (release funds manually from Paystack for now), push/SMS delivery of reminders
(in-app countdown and updates only), rental extensions, in-app chat, native photo/ID upload (web only).
