import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors, useBreakpoint, web } from '@/lib/theme';
import { Brand, Button, T } from './ui';

type Props = {
  favouriteCount: number;
  showingFavourites: boolean;
  onMarketplace: () => void;
  onFavourites: () => void;
  onList: () => void;
};

function NavLink({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={web({ cursor: 'pointer' })}
    >
      {(s: any) => (
        <T style={{ fontWeight: '600', color: active || s.hovered ? colors.green : colors.navText, fontSize: 14 }}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

export function Header({ favouriteCount, showingFavourites, onMarketplace, onFavourites, onList }: Props) {
  const { isSm, isMd } = useBreakpoint();
  const { user, displayName, signOut } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const favLabel = `♥ Favourites${favouriteCount ? ` (${favouriteCount})` : ''}`;
  const go = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const authControl = user ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.mint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <T style={{ color: colors.green, fontWeight: '800', fontSize: 14 }}>{displayName.charAt(0).toUpperCase()}</T>
      </View>
      <NavLink label="Sign out" onPress={go(() => signOut())} />
    </View>
  ) : (
    <NavLink label="Sign in" onPress={go(() => router.push('/auth'))} />
  );

  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          zIndex: 10,
        },
        web({ backdropFilter: 'blur(8px)' }),
      ]}
    >
      <View
        style={{
          height: isSm ? 66 : 76,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: isSm ? 16 : '6%',
        }}
      >
        <Pressable onPress={onMarketplace} accessibilityRole="link" style={web({ cursor: 'pointer' })}>
          <Brand size={isSm ? 20 : 23} />
        </Pressable>

        {isMd ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Button label="Find equipment ↗" small={isSm} onPress={onMarketplace} />
            <Pressable
              accessibilityLabel="Menu"
              accessibilityRole="button"
              onPress={() => setMenuOpen((o) => !o)}
              style={[
                {
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.btnBorder,
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                web({ cursor: 'pointer' }),
              ]}
            >
              <Text style={{ fontSize: 20, color: colors.green }}>{menuOpen ? '×' : '☰'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 27 }}>
            <NavLink label="Marketplace" onPress={onMarketplace} />
            <NavLink label={favLabel} onPress={onFavourites} active={showingFavourites} />
            <NavLink label="List equipment" onPress={onList} />
            {authControl}
            <Button label="Find equipment ↗" onPress={onMarketplace} />
          </View>
        )}
      </View>

      {isMd && menuOpen ? (
        <View
          style={{
            paddingHorizontal: isSm ? 16 : '6%',
            paddingBottom: 16,
            gap: 16,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            paddingTop: 16,
          }}
        >
          <NavLink label="Marketplace" onPress={go(onMarketplace)} />
          <NavLink label={favLabel} onPress={go(onFavourites)} active={showingFavourites} />
          <NavLink label="List equipment" onPress={go(onList)} />
          {authControl}
        </View>
      ) : null}
    </View>
  );
}
