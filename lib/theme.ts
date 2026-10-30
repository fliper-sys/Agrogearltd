import { Platform, useWindowDimensions } from 'react-native';

export const colors = {
  green: '#174c35',
  green2: '#246647',
  mint: '#c9ead5',
  cream: '#f8f7f0',
  white: '#ffffff',
  ink: '#1d3025',
  muted: '#778278',
  line: '#e7e9df',
  coral: '#ed8b73',
  heartSaved: '#df695a',
  heartIdle: '#677168',
  heroCircle: '#316d4e',
  heroEyebrow: '#bce9c9',
  heroText: '#d0e1d5',
  heroBorder: '#769582',
  footer: '#123b29',
  footerMuted: '#b7cbbd',
  footerText: '#e6f0e8',
  navText: '#526057',
  chipText: '#59675d',
  chipBorder: '#dfe5da',
  btnBorder: '#d7ded3',
  fieldLabel: '#536157',
  available: '#34804f',
  toast: '#163e2b',
  overlay: '#10291dbd',
  imageBg: '#edf1e6',
  newListing: '#dcecdf',
  error: '#b4432d',
  errorBg: '#fdeee9',
};

export const fontFamily = Platform.select({
  web: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  default: undefined,
});

/** Style props that only exist on react-native-web (cursor, transitions, filters). */
export const web = (style: Record<string, unknown>): any => (Platform.OS === 'web' ? style : {});

export const emojiShadow = (y: number, blur: number, color: string): any =>
  Platform.OS === 'web'
    ? { filter: `drop-shadow(0px ${y}px ${blur}px ${color})` }
    : { textShadowColor: color, textShadowOffset: { width: 0, height: y }, textShadowRadius: blur };

export const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isSm: width <= 560,
    isMd: width <= 850,
    columns: width <= 560 ? 1 : width <= 850 ? 2 : 3,
  };
}
