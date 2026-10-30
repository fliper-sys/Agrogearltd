import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, useBreakpoint, web } from '@/lib/theme';
import { Brand, T } from './ui';

/** Shared frame for secondary pages: brand bar, back link, title and a centred content column. */
export function PageShell({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  const { isSm } = useBreakpoint();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View
        style={{
          height: isSm ? 62 : 72,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: isSm ? 16 : '6%',
        }}
      >
        <Pressable onPress={() => router.replace('/')} accessibilityRole="link" style={web({ cursor: 'pointer' })}>
          <Brand size={isSm ? 19 : 22} />
        </Pressable>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="link" style={web({ cursor: 'pointer' })}>
          <T style={{ color: colors.green, fontWeight: '700', fontSize: 14 }}>← Marketplace</T>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 860, alignSelf: 'center', padding: isSm ? 14 : 28 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginTop: 10, marginBottom: 20 }}>
            <View style={{ flexShrink: 1 }}>
              <T style={{ fontSize: isSm ? 26 : 32, fontWeight: '800', letterSpacing: -1 }}>{title}</T>
              {subtitle ? <T style={{ color: colors.muted, marginTop: 6, lineHeight: 22 }}>{subtitle}</T> : null}
            </View>
            {right}
          </View>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const { isSm } = useBreakpoint();
  return (
    <View
      style={[
        { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: isSm ? 16 : 24, marginBottom: 18 },
        style,
      ]}
    >
      {children}
    </View>
  );
}
