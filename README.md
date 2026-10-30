# AgroGear 🚜🌱

Agricultural equipment marketplace for African farmers: browse, rent and list machinery.
Built with Expo (React Native Web + expo-router), Supabase (auth + Postgres) and deployed on Vercel.

## Setup

1. **Database** — open Supabase → SQL Editor and run, in order:
   1. [`supabase/schema.sql`](supabase/schema.sql) — `equipment`, `favourites`, `bookings`, RLS, 8 showcase listings.
   2. [`supabase/002_features.sql`](supabase/002_features.sql) — profiles and roles, admin/suspension rules, Agro stores,
      messaging, live location sharing, realtime and the `avatars` storage bucket.
   3. Make yourself admin (replace the email): `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`
2. **Auth** — Supabase → Authentication → URL Configuration: set **Site URL** to your Vercel domain and add it
   (plus `http://localhost:8081`) to **Redirect URLs**. Email confirmation can stay on.
   **Google sign-in (optional)** — Google Cloud Console → Credentials → OAuth client (Web). Add
   `https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect URI, then paste the Client ID and Secret in
   Supabase → Authentication → Providers → Google.
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
- `supabase/schema.sql`, `supabase/002_features.sql` — tables, RLS policies, seed data, realtime, storage

## Features

- Marketplace with grid and OpenStreetMap map views, favourites, rental requests, owner listings with optional map pin
- Supabase auth: email/password, Google, password reset; profile editing and avatar upload
- Agro store finder: nearest stores by distance, community-added stores with admin verification
- Messaging between renters and owners with realtime chat and opt-in live location sharing (stops after 4 hours)
- Admin dashboard: stats, edit/restrict users, moderate listings, manage all bookings and stores
