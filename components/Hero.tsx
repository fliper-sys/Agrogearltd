import React from 'react';
import { Text, View } from 'react-native';
import { clamp, colors, emojiShadow, useBreakpoint } from '@/lib/theme';
import { Button, Eyebrow, T } from './ui';

export function Hero({ onExplore, onList }: { onExplore: () => void; onList: () => void }) {
  const { width, isSm, isMd } = useBreakpoint();
  const h1Size = clamp(36, width * 0.045, 58);
  const circle = isMd ? 220 : 300;
  const tractor = isMd ? 120 : clamp(105, width * 0.14, 170);

  return (
    <View
      style={{
        backgroundColor: colors.green,
        borderRadius: isSm ? 20 : 28,
        paddingVertical: isSm ? 26 : isMd ? 32 : 50,
        paddingHorizontal: isSm ? 22 : isMd ? 32 : 50,
        flexDirection: isMd ? 'column' : 'row',
        gap: 30,
        overflow: 'hidden',
      }}
    >
      <View style={{ flex: isMd ? undefined : 1.2 }}>
        <Eyebrow>The smarter way to farm</Eyebrow>
        <T
          style={{
            color: '#fff',
            fontSize: h1Size,
            lineHeight: h1Size * 1.05,
            letterSpacing: isSm ? -1.5 : -2.5,
            fontWeight: '800',
            marginVertical: 15,
            maxWidth: 590,
          }}
        >
          {'The right machine.\nThe right season.'}
        </T>
        <T style={{ color: colors.heroText, lineHeight: 27, maxWidth: 480, fontSize: 16 }}>
          Discover, rent, and list agricultural machinery in one trusted marketplace built for African farmers.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
          <Button variant="heroPrimary" label="Explore machinery →" onPress={onExplore} />
          <Button variant="heroSecondary" label="List your equipment" onPress={onList} />
        </View>
      </View>

      <View
        style={{
          flex: isMd ? undefined : 0.8,
          minHeight: isMd ? 220 : 250,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: circle,
            height: circle,
            borderRadius: circle / 2,
            backgroundColor: colors.heroCircle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[{ fontSize: tractor, lineHeight: tractor * 1.2 }, emojiShadow(16, 8, '#0d3324')]}>🚜</Text>
        </View>
        <ArtTag style={{ top: '12%', right: isSm ? '-2%' : '-4%' }}>🌿 Grow more, worry less</ArtTag>
        <ArtTag style={{ bottom: '12%', left: isSm ? '-2%' : '-4%' }}>✓ Made for farmers</ArtTag>
      </View>
    </View>
  );
}

function ArtTag({ children, style }: { children: string; style: object }) {
  return (
    <View
      style={[
        {
          position: 'absolute',
          backgroundColor: '#fff',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 14,
          boxShadow: '0 8px 25px rgba(13,51,36,0.2)',
        } as any,
        style,
      ]}
    >
      <T style={{ color: colors.green, fontSize: 12, fontWeight: '800' }}>{children}</T>
    </View>
  );
}
