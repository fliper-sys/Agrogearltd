export type Category = 'Tractors' | 'Harvesters' | 'Planting' | 'Tillage' | 'Transport' | 'Irrigation';

export const CATEGORIES: Category[] = ['Tractors', 'Harvesters', 'Planting', 'Tillage', 'Transport', 'Irrigation'];
export const ALL_CATEGORIES = 'All equipment';

export type Equipment = {
  id: number;
  ownerId: string | null;
  name: string;
  category: string;
  price: number;
  location: string;
  description: string;
  emoji: string;
  badge: string;
  color: string;
  featured: boolean;
  latitude: number | null;
  longitude: number | null;
  hidden: boolean;
};

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Abuja, FCT': { lat: 9.0765, lng: 7.3986 },
  'Kaduna, Kaduna': { lat: 10.5105, lng: 7.4165 },
  'Kano, Kano': { lat: 12.0022, lng: 8.5919 },
  'Jos, Plateau': { lat: 9.8965, lng: 8.8583 },
  'Minna, Niger': { lat: 9.6139, lng: 6.5569 },
  'Ibadan, Oyo': { lat: 7.3775, lng: 3.947 },
  'Enugu, Enugu': { lat: 6.4584, lng: 7.5464 },
  'Makurdi, Benue': { lat: 7.7337, lng: 8.5214 },
};

export const CATEGORY_EMOJI: Record<string, string> = {
  Tractors: '🚜',
  Harvesters: '🌾',
  Planting: '🌱',
  Tillage: '⚙️',
  Transport: '🚛',
  Irrigation: '💧',
};

/** Showcase listings. Also used as an offline fallback if the database cannot be reached. */
type SeedRow = Omit<Equipment, 'latitude' | 'longitude' | 'hidden'>;

const RAW_SEED: SeedRow[] = [
  { id: 1, ownerId: null, name: 'John Deere 5050D', category: 'Tractors', price: 85000, location: 'Abuja, FCT', emoji: '🚜', badge: 'Popular', color: '#e7eedf', featured: true, description: 'Versatile utility tractor for ploughing, cultivation, and general farm operations. Ask the owner about implements and delivery.' },
  { id: 2, ownerId: null, name: 'Combine Harvester', category: 'Harvesters', price: 220000, location: 'Kaduna, Kaduna', emoji: '🌾', badge: 'High capacity', color: '#f2ead7', featured: true, description: 'A harvesting solution designed to help reduce harvesting time. Confirm crop compatibility, capacity, and operator availability with the owner.' },
  { id: 3, ownerId: null, name: 'Heavy Duty Plough', category: 'Tillage', price: 28000, location: 'Kano, Kano', emoji: '⚙️', badge: 'Great value', color: '#e9e9df', featured: true, description: 'Tillage implement for soil preparation. Check tractor compatibility and transport arrangements before booking.' },
  { id: 4, ownerId: null, name: 'Precision Planter', category: 'Planting', price: 45000, location: 'Jos, Plateau', emoji: '🌱', badge: 'Season ready', color: '#deeee0', featured: true, description: 'Planting equipment intended to help create more consistent spacing. Confirm seed type, row configuration, and tractor requirements.' },
  { id: 5, ownerId: null, name: 'Water Pump System', category: 'Irrigation', price: 18000, location: 'Minna, Niger', emoji: '💧', badge: 'Water smart', color: '#e0edf0', featured: true, description: 'A portable water-pumping option for farm irrigation. Verify flow rate, power source, hose connections, and water-lifting requirements.' },
  { id: 6, ownerId: null, name: 'Farm Utility Trailer', category: 'Transport', price: 25000, location: 'Ibadan, Oyo', emoji: '🚛', badge: 'Farm essential', color: '#eee5d9', featured: true, description: 'Utility trailer for moving farm inputs and harvested produce. Confirm load capacity, hitch type, and safe road use.' },
  { id: 7, ownerId: null, name: 'Power Tiller', category: 'Tillage', price: 32000, location: 'Enugu, Enugu', emoji: '🛠️', badge: 'Small farms', color: '#e4eadb', featured: true, description: 'Compact tillage equipment for suitable small and medium farm plots. Ask about soil suitability and operator support.' },
  { id: 8, ownerId: null, name: 'Seed Drill Machine', category: 'Planting', price: 39000, location: 'Makurdi, Benue', emoji: '🌾', badge: 'Precision planting', color: '#f1ead8', featured: true, description: 'Seed placement equipment for more organised planting. Confirm calibration and crop suitability before use.' },
];

export const SEED_EQUIPMENT: Equipment[] = RAW_SEED.map((e) => ({
  ...e,
  latitude: CITY_COORDS[e.location]?.lat ?? null,
  longitude: CITY_COORDS[e.location]?.lng ?? null,
  hidden: false,
}));
