import React from 'react';
import { View } from 'react-native';
import { colors, useBreakpoint } from '@/lib/theme';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { web } from '@/lib/theme';
import { Brand, T } from './ui';

export function Footer() {
  const { isSm } = useBreakpoint();
  const router = useRouter();
  return (
    <View
      style={{
        backgroundColor: colors.footer,
        paddingVertical: 32,
        paddingHorizontal: isSm ? 16 : '6%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20,
      }}
    >
      <View style={{ maxWidth: 340 }}>
        <Brand light />
        <T style={{ color: colors.footerText, fontSize: 13, lineHeight: 22, marginTop: 14 }}>
          Connecting farmers to the equipment that helps them grow.
        </T>
      </View>
      <View style={{ gap: 10 }}>
        <T style={{ color: colors.footerText, fontSize: 13, fontWeight: '700' }}>Explore</T>
        <T style={{ color: colors.footerMuted, fontSize: 13 }}>Marketplace · Equipment rental · Owner listings</T>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={() => router.push('/help')} style={web({ cursor: 'pointer' })}>
            <T style={{ color: colors.footerText, fontSize: 13, fontWeight: '600' }}>Help centre</T>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: '/help', params: { tab: 'support' } })} style={web({ cursor: 'pointer' })}>
            <T style={{ color: colors.footerText, fontSize: 13, fontWeight: '600' }}>Contact support</T>
          </Pressable>
        </View>
        <T style={{ color: colors.footerMuted, fontSize: 13 }}>© {new Date().getFullYear()} AgroGear Ltd</T>
      </View>
    </View>
  );
}
