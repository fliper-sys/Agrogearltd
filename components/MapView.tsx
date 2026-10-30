import React from 'react';
import { View } from 'react-native';
import type { MapViewProps } from '@/lib/mapTypes';
import { colors } from '@/lib/theme';
import { T } from './ui';

/** Native fallback: the interactive map is provided by MapView.web.tsx. */
export default function MapView({ height = 360 }: MapViewProps) {
  return (
    <View style={{ height, borderRadius: 16, backgroundColor: colors.imageBg, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <T style={{ color: colors.muted, textAlign: 'center' }}>🗺 The live map is available in the web app.</T>
    </View>
  );
}
