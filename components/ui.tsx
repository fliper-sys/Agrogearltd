import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fontFamily, web } from '@/lib/theme';

/** Text with the brand font and ink colour applied by default. */
export function T({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[{ color: colors.ink, fontFamily }, style]} />;
}

type Variant = 'primary' | 'secondary' | 'heroPrimary' | 'heroSecondary';

const variantStyles: Record<Variant, { bg: string; hover: string; fg: string; border?: string }> = {
  primary: { bg: colors.green, hover: colors.green2, fg: '#fff' },
  secondary: { bg: '#fff', hover: '#f4f7f1', fg: colors.green, border: colors.btnBorder },
  heroPrimary: { bg: colors.mint, hover: '#d8f0e2', fg: colors.green },
  heroSecondary: { bg: 'transparent', hover: '#ffffff14', fg: '#fff', border: colors.heroBorder },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  small,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = variantStyles[variant];
  const isPrimaryish = variant === 'primary' || variant === 'heroPrimary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={((state: any) => [
        {
          backgroundColor: state.hovered ? v.hover : v.bg,
          borderRadius: 12,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          paddingVertical: small ? 9 : isPrimaryish ? 12 : 11,
          paddingHorizontal: small ? 12 : isPrimaryish ? 18 : 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled ? 0.55 : state.pressed ? 0.9 : 1,
        },
        web({ cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background-color .15s' }),
        style,
      ]) as any}
    >
      {loading ? <ActivityIndicator size="small" color={v.fg} /> : null}
      <T style={{ color: v.fg, fontWeight: isPrimaryish ? '800' : '700', fontSize: small ? 12 : 14 }}>{label}</T>
    </Pressable>
  );
}

export function Eyebrow({ children, color = colors.heroEyebrow }: { children: string; color?: string }) {
  return (
    <T style={{ color, textTransform: 'uppercase', letterSpacing: 2, fontSize: 11, fontWeight: '800' }}>{children}</T>
  );
}

export function Brand({ light, size = 23 }: { light?: boolean; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: light ? colors.heroCircle : colors.green,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 22 }}>🌱</Text>
      </View>
      <T style={{ fontSize: size, fontWeight: '800', letterSpacing: -1, color: light ? '#fff' : colors.green }}>
        AgroGear
      </T>
    </View>
  );
}

export function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 7 }, style]}>
      <T style={{ fontSize: 12, fontWeight: '700', color: colors.fieldLabel }}>{label}</T>
      {children}
    </View>
  );
}

export const inputBox: TextStyle = {
  width: '100%',
  borderWidth: 1,
  borderColor: colors.chipBorder,
  borderRadius: 11,
  padding: 12,
  backgroundColor: '#fff',
  color: colors.ink,
  fontSize: 14,
  fontFamily,
};

export function TextField(props: TextInputProps & { multiline?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor="#9aa59c"
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        inputBox,
        props.multiline ? { minHeight: 90, textAlignVertical: 'top' } : null,
        focused ? { borderColor: '#8cb89b' } : null,
        web({ outlineStyle: 'none' }),
        props.style,
      ]}
    />
  );
}

/** Native <input type="date"> on web, YYYY-MM-DD text input elsewhere. */
export function DateField({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'date',
      value,
      min,
      required: true,
      onChange: (e: any) => onChange(e.target.value),
      style: { ...(inputBox as any), outlineColor: '#8cb89b', boxSizing: 'border-box' },
    });
  }
  return <TextField value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" />;
}

/** Native <select> on web, wrapping chips elsewhere. */
export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  style?: any;
}) {
  if (Platform.OS === 'web') {
    return React.createElement(
      'select',
      {
        value,
        onChange: (e: any) => onChange(e.target.value),
        style: { ...(inputBox as any), outlineColor: '#8cb89b', boxSizing: 'border-box', ...style },
      },
      placeholder ? React.createElement('option', { value: '' }, placeholder) : null,
      ...options.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={((s: any) => [
        {
          paddingVertical: 9,
          paddingHorizontal: 15,
          borderRadius: 99,
          borderWidth: 1,
          borderColor: active ? colors.green : s.hovered ? '#c3cfbf' : colors.chipBorder,
          backgroundColor: active ? colors.green : '#fff',
        },
        web({ cursor: 'pointer', transition: 'all .15s' }),
      ]) as any}
    >
      <T style={{ fontSize: 13, fontWeight: '700', color: active ? '#fff' : colors.chipText }}>{label}</T>
    </Pressable>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <T style={{ fontSize: 12, color: colors.muted, lineHeight: 19, marginTop: 12 }}>{children}</T>;
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <View style={{ backgroundColor: colors.errorBg, borderRadius: 10, padding: 11, marginTop: 14 }}>
      <T style={{ color: colors.error, fontSize: 13, lineHeight: 19 }}>{children}</T>
    </View>
  );
}
