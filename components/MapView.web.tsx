import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import type { MapMarker, MapViewProps } from '@/lib/mapTypes';
import { colors } from '@/lib/theme';

const NIGERIA: [number, number] = [9.082, 8.6753];

function pinIcon(m: MapMarker) {
  const html =
    `<div style="width:38px;height:38px;border-radius:50%;background:${m.color ?? '#fff'};border:2px solid ${colors.green};` +
    `box-shadow:0 4px 12px rgba(23,76,53,.35);display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;">${m.emoji}</div>`;
  return L.divIcon({ html, className: '', iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -20] });
}

/** OpenStreetMap-backed map. Emoji pins match the AgroGear look. */
export default function MapView({ markers, height = 360, fitKey, onMapPress }: MapViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinsRef = useRef<Map<string, L.Marker>>(new Map());
  const pressRef = useRef(onMapPress);
  pressRef.current = onMapPress;
  const fittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const map = L.map(hostRef.current, { scrollWheelZoom: false }).setView(NIGERIA, 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => pressRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 50);
    const pins = pinsRef.current;
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      pins.clear();
      fittedRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pins = pinsRef.current;
    const seen = new Set<string>();

    markers.forEach((m) => {
      seen.add(m.id);
      let pin = pins.get(m.id);
      if (!pin) {
        pin = L.marker([m.lat, m.lng], { icon: pinIcon(m) }).addTo(map);
        pins.set(m.id, pin);
      } else {
        pin.setLatLng([m.lat, m.lng]);
        pin.setIcon(pinIcon(m));
      }
      pin.off('click');
      if (m.label) {
        const el = document.createElement('div');
        el.style.cssText = 'font:600 13px Inter,system-ui,sans-serif;color:#1d3025;';
        el.textContent = m.label;
        pin.unbindPopup().bindPopup(el);
      }
      if (m.onPress) pin.on('click', () => m.onPress?.());
    });

    pins.forEach((pin, id) => {
      if (!seen.has(id)) {
        pin.remove();
        pins.delete(id);
      }
    });

    const key = fitKey ?? 'initial';
    if (markers.length && fittedRef.current !== key) {
      fittedRef.current = key;
      if (markers.length === 1) map.setView([markers[0].lat, markers[0].lng], 12);
      else map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [40, 40], maxZoom: 13 });
    }
  }, [markers, fitKey]);

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
      {React.createElement('div', { ref: hostRef, style: { height: '100%', width: '100%' } })}
    </View>
  );
}
