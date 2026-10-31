import type { Coords } from './geo';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  emoji: string;
  label?: string;
  /** Pin background colour. */
  color?: string;
  onPress?: () => void;
};

export type MapViewProps = {
  markers: MapMarker[];
  height?: number;
  /** Re-fits the map to the markers whenever this value changes. */
  fitKey?: string;
  onMapPress?: (c: Coords) => void;
};
