import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useRentals } from '@/context/RentalsContext';
import { colors, useBreakpoint, web } from '@/lib/theme';
import { Avatar } from './Avatar';
import { Brand, Button, T } from './ui';

type Props = {
  favouriteCount?: number;
  showingFavourites?: boolean;
  /** Provided only by the marketplace screen; other screens link back to it. */
  onMarketplace?: () => void;
  onFavourites?: () => void;
  onList?: () => void;
  active?: 'stores' | 'messages' | 'admin' | 'profile' | 'rentals';
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

export function Header({ favouriteCount = 0, showingFavourites = false, onMarketplace: onHome, onFavourites, onList, active }: Props) {
  const { width, isSm } = useBreakpoint();
  const isMd = width <= 1100;
  const { user, displayName, signOut, profile } = useAuth();
  const router = useRouter();
  const { actionNeeded, unread } = useRentals();
  const [menuOpen, setMenuOpen] = useState(false);

  const router2 = router;
  const onMarketplace = onHome ?? (() => router2.push('/'));
  const badge = Math.max(actionNeeded, unread);
  const rentLabel = `My rentals${badge ? ` (${badge})` : ''}`;
  const favLabel = `♥ Favourites${favouriteCount ? ` (${favouriteCount})` : ''}`;
  const go = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const links: { label: string; onPress: () => void; active?: boolean }[] = [
    { label: 'Marketplace', onPress: onMarketplace },
    ...(onFavourites ? [{ label: favLabel, onPress: onFavourites, active: showingFavourites }] : []),
    ...(onList ? [{ label: 'List equipment', onPress: onList }] : []),
    ...(user ? [{ label: rentLabel, onPress: () => router.push('/rentals'), active: active === 'rentals' }] : []),
    { label: '🏪 Agro stores', onPress: () => router.push('/stores'), active: active === 'stores' },
    ...(user ? [{ label: '💬 Messages', onPress: () => router.push('/messages'), active: active === 'messages' }] : []),
    ...(profile?.isAdmin ? [{ label: '🛡 Admin', onPress: () => router.push('/admin'), active: active === 'admin' }] : []),
  ];

  const authControl = user ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable accessibilityRole="link" accessibilityLabel="Your profile" onPress={go(() => router.push('/profile'))} style={web({ cursor: 'pointer' })}>
        <Avatar url={profile?.avatarUrl} name={displayName} size={34} />
      </Pressable>
      <NavLink label="Profile" onPress={go(() => router.push('/profile'))} active={active === 'profile'} />
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
            {links.map((l) => (
              <NavLink key={l.label} label={l.label} onPress={l.onPress} active={l.active} />
            ))}
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
          {links.map((l) => (
            <NavLink key={l.label} label={l.label} onPress={go(l.onPress)} active={l.active} />
          ))}
          {authControl}
        </View>
      ) : null}
    </View>
  );
}
