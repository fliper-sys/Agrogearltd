import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { colors } from '@/lib/theme';
import { T } from './ui';

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string) => {
    setMessage(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2800);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              bottom: 26,
              left: 0,
              right: 0,
              alignItems: 'center',
              zIndex: 100,
              paddingHorizontal: 16,
            },
          ]}
        >
          <View
            accessibilityRole={Platform.OS === 'web' ? ('status' as any) : undefined}
            style={
              {
                backgroundColor: colors.toast,
                paddingVertical: 14,
                paddingHorizontal: 22,
                borderRadius: 15,
                borderWidth: 1,
                borderColor: '#ffffff24',
                maxWidth: '90%',
                boxShadow: '0 14px 34px rgba(15,45,29,0.22)',
              } as any
            }
          >
            <T style={{ color: '#fff', fontSize: 14 }}>{message}</T>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
