import React from 'react';
import { Image, View } from 'react-native';
import { colors } from '@/lib/theme';
import { T } from './ui';

export function Avatar({ url, name, size = 34 }: { url?: string | null; name?: string; size?: number }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.mint }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.mint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T style={{ color: colors.green, fontWeight: '800', fontSize: Math.max(12, size * 0.42) }}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </T>
    </View>
  );
}
