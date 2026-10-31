import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Button, T } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { colors, useBreakpoint, web } from '@/lib/theme';

type Step = { emoji: string; title: string; body: string; cta?: { label: string; href: string } };

export const TOUR_STEPS: Step[] = [
  { emoji: '👋', title: 'Welcome to AgroGear', body: 'Rent farm machinery from verified owners across Nigeria, or earn from your own equipment. This 1-minute tour shows you around.' },
  { emoji: '🔎', title: 'Find the right machine', body: 'Search by name, category, state and price. Switch to Map view to see machines near you, and tap ♥ to save favourites.', cta: { label: 'Browse equipment', href: '/' } },
  { emoji: '📅', title: 'Request a rental', body: 'Pick your dates and send a request. You only pay after the owner approves, and your payment is held securely until the rental is complete.' },
  { emoji: '💬', title: 'Chat and track the machine', body: 'Message any owner. During delivery either side can share a live location so you can watch the machine on a map.', cta: { label: 'Open messages', href: '/messages' } },
  { emoji: '🚜', title: 'List your own equipment', body: 'Add photos, price, deposit and pickup or delivery options, then pin the location. Verified owners get a badge and rank higher.', cta: { label: 'Complete your profile', href: '/profile' } },
  { emoji: '🏪', title: 'Find Agro stores nearby', body: 'Locate the nearest Agro store from your location, or add one you know so other farmers can find it.', cta: { label: 'Agro stores', href: '/stores' } },
  { emoji: '⭐', title: 'Reviews build trust', body: 'After a completed rental both sides leave a star rating and comment. Owners can reply publicly. Check profiles before you rent.' },
  { emoji: '🛟', title: 'We are here to help', body: 'Browse step-by-step guides and FAQs in the Help centre, or contact support any time. Replies show up in your notifications.', cta: { label: 'Open Help centre', href: '/help' } },
];

type TourState = { openTour: () => void };
const TourContext = createContext<TourState | null>(null);

const SEEN_KEY = 'ag_tour_seen';
const safeGet = () => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(SEEN_KEY) : '1';
  } catch {
    return '1';
  }
};
const safeSet = () => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SEEN_KEY, '1');
  } catch {}
};

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { isSm } = useBreakpoint();
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, setTourDone } = useAuth();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  const openTour = useCallback(() => {
    setI(0);
    setOpen(true);
  }, []);

  const finish = useCallback(() => {
    setOpen(false);
    safeSet();
    if (user) setTourDone(true);
  }, [user, setTourDone]);

  // First visit: signed-in users until they finish once (saved on their profile), guests once per browser.
  useEffect(() => {
    if (loading || open) return;
    if (pathname !== '/' && pathname !== '/profile') return;
    const due = user ? Boolean(profile) && !profile!.tourDone && safeGet() !== '1' : safeGet() !== '1';
    if (!due) return;
    const t = setTimeout(openTour, 1200);
    return () => clearTimeout(t);
  }, [loading, user, profile?.id, profile?.tourDone, pathname, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({ openTour }), [openTour]);
  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;

  return (
    <TourContext.Provider value={value}>
      {children}
      <Modal visible={open} transparent animationType="fade" onRequestClose={finish}>
        <View style={{ flex: 1, backgroundColor: 'rgba(14,32,22,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 460, backgroundColor: colors.cream, borderRadius: 24, padding: isSm ? 22 : 30 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>Step {i + 1} of {TOUR_STEPS.length}</T>
              <Pressable onPress={finish} style={web({ cursor: 'pointer' })}>
                <T style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>Skip</T>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              {TOUR_STEPS.map((_, n) => (
                <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= i ? colors.green : '#dfe4d8' }} />
              ))}
            </View>
            <T style={{ fontSize: 54, marginTop: 22, textAlign: 'center' }}>{step.emoji}</T>
            <T style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.6, marginTop: 10, textAlign: 'center' }}>{step.title}</T>
            <T style={{ color: colors.muted, lineHeight: 24, marginTop: 10, textAlign: 'center' }}>{step.body}</T>
            {step.cta ? (
              <Pressable
                onPress={() => {
                  finish();
                  router.push(step.cta!.href as any);
                }}
                style={[{ alignSelf: 'center', marginTop: 14 }, web({ cursor: 'pointer' })]}
              >
                <T style={{ color: colors.green, fontWeight: '800', fontSize: 14 }}>{step.cta.label} →</T>
              </Pressable>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 10 }}>
              <Button variant="secondary" label="Back" onPress={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} />
              <Button label={last ? 'Get started 🌱' : 'Next →'} onPress={() => (last ? finish() : setI((n) => n + 1))} />
            </View>
          </View>
        </View>
      </Modal>
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used inside TourProvider');
  return ctx;
}
