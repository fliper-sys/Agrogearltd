import React from 'react';
import { View } from 'react-native';
import { colors } from '@/lib/theme';
import { pad, useCountdown } from '@/lib/time';
import { T } from './ui';

/**
 * Live countdown. Colour shifts as time runs low:
 * calm green > 24h, amber < 24h, red < 1h or overdue.
 */
export function Countdown({ target, label, doneLabel = 'Time is up' }: { target: string | null; label: string; doneLabel?: string }) {
  const c = useCountdown(target);
  if (!c) return null;

  const hoursLeft = c.totalMs / 3600000;
  const tone = c.overdue || hoursLeft < 1 ? 'red' : hoursLeft < 24 ? 'amber' : 'green';
  const palette = {
    green: { bg: '#e6f2ea', fg: colors.green },
    amber: { bg: '#fdf3d9', fg: '#8a6414' },
    red: { bg: colors.errorBg, fg: colors.error },
  }[tone];

  const cells: [string, string][] = [
    [String(c.days), 'days'],
    [pad(c.hours), 'hrs'],
    [pad(c.minutes), 'min'],
    [pad(c.seconds), 'sec'],
  ];

  return (
    <View style={{ backgroundColor: palette.bg, borderRadius: 14, padding: 14, marginTop: 14 }} accessibilityRole="timer">
      <T style={{ color: palette.fg, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
        {c.overdue ? `${doneLabel} · overdue by` : label}
      </T>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        {cells.map(([v, u]) => (
          <View key={u} style={{ minWidth: 54, alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6 }}>
            <T style={{ fontSize: 22, fontWeight: '800', color: palette.fg, fontVariant: ['tabular-nums'] }}>{v}</T>
            <T style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>{u}</T>
          </View>
        ))}
      </View>
      {tone === 'amber' && !c.overdue ? (
        <T style={{ color: palette.fg, fontSize: 12, marginTop: 10 }}>Less than 24 hours left. Plan the return with the owner.</T>
      ) : null}
      {tone === 'red' ? (
        <T style={{ color: palette.fg, fontSize: 12, marginTop: 10 }}>
          {c.overdue ? 'Return the machine now and mark it returned, or contact the owner to extend.' : 'Under an hour left. Get ready to return the machine.'}
        </T>
      ) : null}
    </View>
  );
}
