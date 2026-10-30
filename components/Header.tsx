import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { colors, useBreakpoint, web } from '@/lib/theme';
import { Avatar } from './Avatar';
import { Brand, Button, T } from './ui';

type Props = {
  favouriteCount?: number;
  showingFavourites?: boolean;
  /** Provided only by the marketplace screen; other screens link back to it. */
  home?: { onMarketplace: () => void; onFavourites: () => void; onList: () => void };
  active?: 'stores' | 'messages' | 'admin' | 'profile';
};

function NavLink({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={web({ cursor: 'pointer' })}>
      {(s: any) => (
        <T style={{ fontWeight: active ? '800' : '600', color: active || s.hovered ? colors.green : colors.navText, fontSize: 14 }}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

export function Header({ favouriteCount = 0, showingFavourites, home, active }: Props) {
  const { width, isSm } = useBreakpoint();
  const compact = width <= 1100;
  const { user, displayName, signOut } = useAuth();
  const { profile, isAdmin } = useProfile();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };
  const toMarketplace = home?.onMarketplace ?? (() => router.push('/'));
  const favLabel = `♥ Favourites${favouriteCount ? ` (${favouriteCount})` : ''}`;

  const links: { label: string; onPress: () => void; active?: boolean }[] = [
    { label: 'Marketplace', onPress: toMarketplace },
    ...(home ? [{ label: favLabel, onPress: home.onFavourites, active: showingFavourites }] : []),
    ...(home ? [{ label: 'List equipment', onPress: home.onList }] : []),
    { label: '🏪 Agro stores', onPress: () => router.push('/stores'), active: active === 'stores' },
    { label: '💬 Messages', onPress: () => router.push('/messages'), active: active === 'messages' },
    ...(isAdmin ? [{ label: '🛡 Admin', onPress: () => router.push('/admin'), active: active === 'admin' }] : []),
  ];

  const accountControl = user ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Your profile"
        onPress={go(() => router.push('/profile'))}
        style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, web({ cursor: 'pointer' })]}
      >
        <Avatar url={profile?.avatar_url} name={displayName} size={34} />
        {menuOpen || !compact ? (
          <T style={{ fontSize: 14, fontWeight: active === 'profile' ? '800' : '600', color: colors.navText }}>Profile</T>
        ) : null}
      </Pressable>
      <NavLink label="Sign out" onPress={go(() => signOut())} />
    </View>
  ) : (
    <NavLink label="Sign in" onPress={go(() => router.push('/auth'))} />
  );

  return (
    <View
      style={[
        { backgroundColor: 'rgba(255,255,255,0.92)', borderBottomWidth: 1, borderBottomColor: colors.line, zIndex: 10 },
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
        <Pressable onPress={toMarketplace} accessibilityRole="link" style={web({ cursor: 'pointer' })}>
          <Brand size={isSm ? 20 : 23} />
        </Pressable>

        {compact ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {!isSm ? <Button label="Find equipment ↗" onPress={toMarketplace} /> : null}
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
            {accountControl}
            <Button label="Find equipment ↗" onPress={toMarketplace} />
          </View>
        )}
      </View>

      {compact && menuOpen ? (
        <View
          style={{
            paddingHorizontal: isSm ? 16 : '6%',
            paddingBottom: 16,
            paddingTop: 16,
            gap: 16,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          {links.map((l) => (
            <NavLink key={l.label} label={l.label} onPress={go(l.onPress)} active={l.active} />
          ))}
          {accountControl}
        </View>
      ) : null}
    </View>
  );
}
