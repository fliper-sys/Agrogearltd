import { ALL_CATEGORIES, Equipment } from './data';

export type Sort = 'featured' | 'newest' | 'low' | 'high' | 'rating';

export type Filters = {
  query: string;
  category: string;
  state: string;
  minPrice: string;
  maxPrice: string;
  verifiedOnly: boolean;
  deliveryOnly: boolean;
  operatorOnly: boolean;
  condition: string;
  from: string; // YYYY-MM-DD
  to: string;
  sort: Sort;
};

export type Range = { equipmentId: number; start: string; end: string };

export const DEFAULT_FILTERS: Filters = {
  query: '',
  category: ALL_CATEGORIES,
  state: '',
  minPrice: '',
  maxPrice: '',
  verifiedOnly: false,
  deliveryOnly: false,
  operatorOnly: false,
  condition: '',
  from: '',
  to: '',
  sort: 'featured',
};

/** Number of filters that differ from the defaults (sort is not counted). */
export function activeFilterCount(f: Filters) {
  return [
    f.query.trim(),
    f.category !== ALL_CATEGORIES,
    f.state,
    f.minPrice,
    f.maxPrice,
    f.verifiedOnly,
    f.deliveryOnly,
    f.operatorOnly,
    f.condition,
    f.from || f.to,
  ].filter(Boolean).length;
}

export const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && bStart <= aEnd;

/** Every search word must match somewhere in the listing text, so "kano tractor" finds a tractor in Kano. */
function matchesText(e: Equipment, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [e.name, e.category, e.location, e.state, e.description, e.specs, e.condition, e.ownerName].join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

export function filterEquipment(list: Equipment[], f: Filters, ranges: Range[], favourites?: Set<number>): Equipment[] {
  const min = f.minPrice ? Number(f.minPrice) : 0;
  const max = f.maxPrice ? Number(f.maxPrice) : Infinity;
  const from = f.from || f.to;
  const to = f.to || f.from;

  const out = list.filter((e) => {
    if (favourites && !favourites.has(e.id)) return false;
    if (f.category !== ALL_CATEGORIES && e.category !== f.category) return false;
    if (f.state && e.state !== f.state) return false;
    if (e.price < min || e.price > max) return false;
    if (f.verifiedOnly && !e.ownerVerified) return false;
    if (f.deliveryOnly && !e.deliveryAvailable) return false;
    if (f.operatorOnly && !e.withOperator) return false;
    if (f.condition && e.condition !== f.condition) return false;
    if (from && to && ranges.some((r) => r.equipmentId === e.id && overlaps(r.start, r.end, from, to))) return false;
    return matchesText(e, f.query);
  });

  const byFeatured = (a: Equipment, b: Equipment) => Number(b.featured) - Number(a.featured) || a.id - b.id;
  switch (f.sort) {
    case 'low': return out.sort((a, b) => a.price - b.price || a.id - b.id);
    case 'high': return out.sort((a, b) => b.price - a.price || a.id - b.id);
    case 'newest': return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    case 'rating': return out.sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount || byFeatured(a, b));
    default:
      // Verified owners rank slightly higher within the featured ordering.
      return out.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.ownerVerified) - Number(a.ownerVerified) || a.id - b.id);
  }
}
