import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/context/AuthContext';
import { TourProvider } from '@/context/TourContext';
import { LiveShareProvider } from '@/context/LiveShareContext';
import { StatusBanners } from '@/components/StatusBanners';
import { MarketProvider } from '@/context/MarketContext';
import { RentalsProvider } from '@/context/RentalsContext';
import { ToastProvider } from '@/components/Toast';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MarketProvider>
          <RentalsProvider>
            <ToastProvider>
              <LiveShareProvider>
                <TourProvider>
              <View style={{ flex: 1, backgroundColor: colors.cream }}>
                <StatusBar style="dark" />
                <StatusBanners />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }} />
              </View>
                </TourProvider>
              </LiveShareProvider>
            </ToastProvider>
          </RentalsProvider>
        </MarketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
