import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLiveShare } from '@/context/LiveShareContext';
import { useProfile } from '@/context/ProfileContext';
import { colors, web } from '@/lib/theme';
import { T } from './ui';

export function StatusBanners() {
  const { profile, isSuspended } = useProfile();
  const { sharingConversationId, stop } = useLiveShare();
  const router = useRouter();

  return (
    <>
      {isSuspended ? (
        <View style={{ backgroundColor: colors.coral, paddingVertical: 10, paddingHorizontal: 16 }}>
          <T style={{ color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
            Your account is restricted{profile?.suspended_reason ? `: ${profile.suspended_reason}` : '.'} You can browse, but cannot list, book or message.
          </T>
        </View>
      ) : null}
      {sharingConversationId ? (
        <View
          style={{
            backgroundColor: colors.green,
            paddingVertical: 9,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <T style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>📍 Sharing your live location</T>
          <Pressable onPress={() => router.push(`/chat/${sharingConversationId}`)} style={web({ cursor: 'pointer' })}>
            <T style={{ color: colors.mint, fontSize: 13, fontWeight: '700' }}>Open chat</T>
          </Pressable>
          <Pressable onPress={() => stop()} style={web({ cursor: 'pointer' })}>
            <T style={{ color: '#fff', fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' }}>Stop sharing</T>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}
