import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, PageShell } from '@/components/PageShell';
import { SupportPanel } from '@/components/SupportPanel';
import { Button, Chip, T } from '@/components/ui';
import { useTour } from '@/context/TourContext';
import { colors, web } from '@/lib/theme';

type Guide = { title: string; emoji: string; steps: { title: string; body: string }[] };

const GUIDES: Record<'renter' | 'owner' | 'safety', Guide> = {
  renter: {
    title: 'Renting a machine',
    emoji: '🧑‍🌾',
    steps: [
      { title: 'Complete your profile', body: 'Add your name, phone and state in Profile & settings. Owners trust complete profiles, and you need them to book.' },
      { title: 'Find a machine', body: 'Use search, category and state filters, or open Map view to see what is nearby. Tap a listing for photos, specs, reviews and the owner profile.' },
      { title: 'Request your dates', body: 'Choose pickup or delivery and send the request. The price is calculated by the server, so it cannot be changed after you send it.' },
      { title: 'Pay once approved', body: 'When the owner approves, pay in the app. Your money is held securely and only released to the owner after the rental is complete.' },
      { title: 'Track and receive', body: 'Chat with the owner and use Share live location to follow delivery. Confirm receipt to start the rental countdown.' },
      { title: 'Return and review', body: 'Mark the machine returned. After the owner confirms its condition your deposit is released, and you can rate the rental.' },
    ],
  },
  owner: {
    title: 'Listing your equipment',
    emoji: '🚜',
    steps: [
      { title: 'Get verified', body: 'Upload a clear photo of an ID in Profile & settings. A verified badge helps your listings rank higher and win more requests.' },
      { title: 'Create the listing', body: 'Scroll to “Put your machinery to work” on the marketplace. Add photos, price, deposit, condition, and pickup or delivery options. Pin your location so renters can find you on the map.' },
      { title: 'Respond to requests', body: 'Open My rentals to approve or decline. Message the renter first if you need details.' },
      { title: 'Dispatch the machine', body: 'Once payment is held, dispatch or hand over the machine. Share your live location in chat while it is on the way.' },
      { title: 'Inspect on return', body: 'Check the machine when it comes back and confirm the condition to complete the rental and release the deposit.' },
      { title: 'Reply to reviews', body: 'Reply publicly to reviews and rate your renters. Good ratings on both sides make the marketplace safer for everyone.' },
    ],
  },
  safety: {
    title: 'Staying safe',
    emoji: '🛡',
    steps: [
      { title: 'Keep payments in the app', body: 'Never pay outside AgroGear. Payments in the app are protected until the rental is complete.' },
      { title: 'Check profiles and reviews', body: 'Look for the ✓ Verified badge, completed rentals and recent reviews before you agree to anything.' },
      { title: 'Inspect and record', body: 'Take photos of the machine at handover and at return. These help if there is a disagreement.' },
      { title: 'Open a dispute early', body: 'If something is wrong after dispatch, open a dispute from My rentals. Payment stays on hold while we look into it.' },
      { title: 'Report anything suspicious', body: 'Use Contact support → Safety / dispute to report listings or users that worry you.' },
    ],
  },
};

const FAQ: { q: string; a: string }[] = [
  { q: 'When do I pay?', a: 'Only after the owner approves your request. Payment is then held securely until the rental is complete.' },
  { q: 'What is the refundable deposit?', a: 'A deposit some owners require. It is released back to you after the owner confirms the machine came back in the agreed condition.' },
  { q: 'How does live location work?', a: 'Open a chat and tap Share live location. The other person sees a moving pin while you keep the app open. Sharing stops by itself after 4 hours, or when you tap Stop.' },
  { q: 'How do I become verified?', a: 'Open Profile & settings, choose an ID type, enter the number and upload a photo. We usually review within 1–2 working days.' },
  { q: 'Can I edit my review?', a: 'Yes, for 14 days after you post it. Owners can reply publicly to any review of their equipment.' },
  { q: 'Why is my account restricted?', a: 'An administrator restricted it, usually after a report. You can still browse. Contact support to ask for a review.' },
  { q: 'How do Agro stores get on the map?', a: 'Anyone signed in can add a store. Our team verifies new stores, and verified ones are marked.' },
];

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ color: colors.green, fontWeight: '800', fontSize: 13 }}>{n}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '800', fontSize: 15 }}>{title}</T>
        <T style={{ color: colors.muted, lineHeight: 22, fontSize: 14, marginTop: 2 }}>{body}</T>
      </View>
    </View>
  );
}

export default function Help() {
  const { tab: initial } = useLocalSearchParams<{ tab?: string }>();
  const { openTour } = useTour();
  const [tab, setTab] = useState<'renter' | 'owner' | 'safety' | 'support'>(
    initial === 'support' ? 'support' : initial === 'owner' || initial === 'safety' ? initial : 'renter',
  );
  const [openQ, setOpenQ] = useState<number | null>(null);
  const guide = tab === 'support' ? null : GUIDES[tab];

  return (
    <PageShell title="Help centre" subtitle="Step-by-step guides, answers to common questions, and a direct line to our team.">
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <T style={{ fontSize: 34 }}>🌱</T>
          <View style={{ flex: 1, minWidth: 200 }}>
            <T style={{ fontWeight: '800', fontSize: 16 }}>New to AgroGear?</T>
            <T style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>Take the 1-minute walkthrough of the app.</T>
          </View>
          <Button label="Start the tour" onPress={openTour} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 18 }}>
        <Chip label="🧑‍🌾 Renting" active={tab === 'renter'} onPress={() => setTab('renter')} />
        <Chip label="🚜 Listing" active={tab === 'owner'} onPress={() => setTab('owner')} />
        <Chip label="🛡 Safety" active={tab === 'safety'} onPress={() => setTab('safety')} />
        <Chip label="🛟 Contact support" active={tab === 'support'} onPress={() => setTab('support')} />
      </View>

      {guide ? (
        <>
          <Card>
            <T style={{ fontSize: 19, fontWeight: '800', marginBottom: 16 }}>{guide.emoji} {guide.title}</T>
            <View style={{ gap: 16 }}>
              {guide.steps.map((s, i) => (
                <Step key={s.title} n={i + 1} title={s.title} body={s.body} />
              ))}
            </View>
          </Card>
          <Card>
            <T style={{ fontSize: 19, fontWeight: '800', marginBottom: 8 }}>Frequently asked questions</T>
            {FAQ.map((f, i) => (
              <Pressable
                key={f.q}
                onPress={() => setOpenQ(openQ === i ? null : i)}
                style={[{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, paddingVertical: 12 }, web({ cursor: 'pointer' })]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <T style={{ fontWeight: '700', flex: 1 }}>{f.q}</T>
                  <T style={{ color: colors.green, fontWeight: '800' }}>{openQ === i ? '−' : '+'}</T>
                </View>
                {openQ === i ? <T style={{ color: colors.muted, lineHeight: 22, marginTop: 8, fontSize: 14 }}>{f.a}</T> : null}
              </Pressable>
            ))}
            <T style={{ color: colors.muted, fontSize: 13, marginTop: 12 }}>Still stuck? Open “Contact support” above.</T>
          </Card>
        </>
      ) : (
        <Card>
          <SupportPanel />
        </Card>
      )}
    </PageShell>
  );
}
