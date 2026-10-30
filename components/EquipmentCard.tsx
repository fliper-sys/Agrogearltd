import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Equipment } from '@/lib/data';
import { money } from '@/lib/format';
import { colors, emojiShadow, useBreakpoint, web } from '@/lib/theme';
import { Button, T } from './ui';

export function EquipmentCard({
  item,
  width,
  saved,
  onToggleFavourite,
  onOpen,
}: {
  item: Equipment;
  width: number | string;
  saved: boolean;
  onToggleFavourite: () => void;
  onOpen: () => void;
}) {
  const { isSm } = useBreakpoint();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={((s: any) => [
        {
          width,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 20,
          overflow: 'hidden',
          transform: [{ translateY: s.hovered ? -3 : 0 }],
          boxShadow: s.hovered ? '0 14px 32px rgba(24,62,36,0.09)' : '0 0 0 rgba(0,0,0,0)',
        },
        web({ cursor: 'pointer', transition: 'transform .2s, box-shadow .2s' }),
      ]) as any}
    >
      <View
        style={{
          height: isSm ? 205 : 190,
          backgroundColor: item.color || '#e8eee4',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 13,
            left: 13,
            backgroundColor: '#fff',
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 8,
          }}
        >
          <T style={{ fontSize: 10, fontWeight: '800' }}>{item.badge || item.category}</T>
        </View>
        <Text style={[{ fontSize: 92, lineHeight: 110 }, emojiShadow(9, 5, 'rgba(35,60,37,0.11)')]}>
          {item.emoji || '🚜'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from favourites' : 'Add to favourites'}
          onPress={(e: any) => {
            e?.stopPropagation?.();
            onToggleFavourite();
          }}
          style={[
            {
              position: 'absolute',
              top: 11,
              right: 11,
              width: 37,
              height: 37,
              borderRadius: 19,
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            },
            web({ cursor: 'pointer' }),
          ]}
        >
          <T style={{ fontSize: 19, color: saved ? colors.heartSaved : colors.heartIdle }}>{saved ? '♥' : '♡'}</T>
        </Pressable>
      </View>

      <View style={{ padding: 18 }}>
        <T style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>{item.name}</T>
        <T style={{ fontSize: 12, color: colors.muted, marginTop: 8, marginBottom: 15 }}>
          ⌖ {item.location} · {item.category}
        </T>
        <T style={{ fontSize: 21, fontWeight: '800', color: colors.green }}>
          {money(item.price)} <T style={{ fontSize: 11, color: colors.muted, fontWeight: '500' }}>/ day</T>
        </T>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.line,
            paddingTop: 14,
            marginTop: 15,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <T style={{ fontSize: 11, color: colors.available, fontWeight: '700' }}>● Request availability</T>
          <Button label="View details" small onPress={onOpen} />
        </View>
      </View>
    </Pressable>
  );
}
