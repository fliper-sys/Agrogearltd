import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/AuthContext';
import { LiveShareProvider } from '@/context/LiveShareContext';
import { MarketProvider } from '@/context/MarketContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { StatusBanners } from '@/components/StatusBanners';
import { ToastProvider } from '@/components/Toast';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProfileProvider>
          <MarketProvider>
            <ToastProvider>
              <LiveShareProvider>
                <View style={{ flex: 1, backgroundColor: colors.cream }}>
                  <StatusBar style="dark" />
                  <StatusBanners />
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }} />
                </View>
              </LiveShareProvider>
            </ToastProvider>
          </MarketProvider>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
