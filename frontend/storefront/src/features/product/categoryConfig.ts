import type { Product } from './types';

export const sectionLabels = {
  offers: 'Offers',
  description: 'Details',
  specs: 'Specifications',
  widgets: 'Product information',
  reviews: 'Reviews',
  qna: 'Questions & answers',
  policies: 'Trust & policies',
  history: 'Price history',
  together: 'Frequently bought together',
  similar: 'Similar products',
  recent: 'Recently viewed',
};
export type SectionId = keyof typeof sectionLabels;
export type CategoryConfig = {
  aliases?: string[];
  variantOrder: string[];
  defaultIcon: string;
  highlightIcons: Record<string, string>;
  specGroups: string[];
  widgets: { key: string; label: string }[];
  featureLabels: string[];
  contentsLabel: string;
  sectionOrder: SectionId[];
};
const defaults: CategoryConfig = {
  variantOrder: [],
  defaultIcon: 'spark',
  highlightIcons: {},
  specGroups: ['General'],
  widgets: [],
  featureLabels: [],
  contentsLabel: "What's in the box",
  sectionOrder: Object.keys(sectionLabels) as SectionId[],
};
export const categoryConfig: Record<string, CategoryConfig> = {
  default: defaults,
  electronics: {
    ...defaults,
    variantOrder: ['color', 'storage', 'ram'],
    defaultIcon: 'device',
    specGroups: ['Technical specifications', 'General'],
    widgets: [
      { key: 'energy', label: 'Energy rating' },
      { key: 'warranty', label: 'Warranty' },
    ],
  },
  headphones: {
    ...defaults,
    aliases: ['audio'],
    variantOrder: ['color'],
    defaultIcon: 'music',
    highlightIcons: { Battery: 'battery', Sound: 'music' },
    specGroups: ['Audio', 'Connectivity', 'General'],
    featureLabels: ['Sound', 'Battery', 'Comfort'],
    widgets: [{ key: 'warranty', label: 'Warranty' }],
  },
  fashion: {
    ...defaults,
    aliases: ['t-shirt', 't-shirts', 'clothing', 'apparel'],
    variantOrder: ['size', 'color'],
    defaultIcon: 'fabric',
    specGroups: ['Material', 'Fit', 'Care'],
    contentsLabel: 'Care instructions',
    featureLabels: ['Fit', 'Comfort', 'Quality'],
    widgets: [
      { key: 'sizeChart', label: 'Size guide' },
      { key: 'tryOn', label: 'Virtual try-on' },
      { key: 'care', label: 'Care instructions' },
    ],
  },
  shoes: {
    ...defaults,
    aliases: ['footwear'],
    variantOrder: ['size', 'color'],
    defaultIcon: 'fabric',
    featureLabels: ['Fit', 'Comfort', 'Quality'],
    widgets: [
      { key: 'sizeChart', label: 'Size guide' },
      { key: 'care', label: 'Care instructions' },
    ],
  },
  mobile: {
    ...defaults,
    aliases: ['smartphone', 'smartphones', 'mobiles'],
    variantOrder: ['storage', 'ram', 'color'],
    defaultIcon: 'device',
    specGroups: ['Display', 'Performance', 'Camera', 'General'],
    featureLabels: ['Performance', 'Camera', 'Battery'],
    widgets: [{ key: 'warranty', label: 'Warranty' }],
  },
  grocery: {
    ...defaults,
    aliases: ['rice', 'groceries', 'food'],
    variantOrder: ['pack-size', 'weight'],
    defaultIcon: 'leaf',
    specGroups: ['Food information', 'Storage'],
    contentsLabel: 'Ingredients',
    featureLabels: ['Freshness', 'Taste', 'Packaging'],
    widgets: [
      { key: 'diet', label: 'Dietary information' },
      { key: 'expiry', label: 'Shelf life & expiry' },
      { key: 'fssai', label: 'FSSAI information' },
      { key: 'ingredients', label: 'Ingredients' },
      { key: 'nutrition', label: 'Nutrition' },
    ],
  },
  home: {
    ...defaults,
    aliases: ['sofa', 'furniture', 'home-living'],
    variantOrder: ['material', 'dimension', 'color'],
    defaultIcon: 'home',
    specGroups: ['Dimensions', 'Materials', 'Assembly'],
    featureLabels: ['Comfort', 'Quality', 'Assembly'],
    widgets: [
      { key: 'energy', label: 'Energy rating' },
      { key: 'care', label: 'Care instructions' },
      { key: 'warranty', label: 'Warranty' },
    ],
  },
  beauty: {
    ...defaults,
    variantOrder: ['shade', 'size'],
    defaultIcon: 'spark',
    contentsLabel: 'Ingredients',
    widgets: [
      { key: 'ingredients', label: 'Ingredients' },
      { key: 'expiry', label: 'Shelf life' },
      { key: 'tryOn', label: 'Virtual try-on' },
    ],
  },
  sports: {
    ...defaults,
    variantOrder: ['size', 'weight', 'color'],
    defaultIcon: 'activity',
    widgets: [
      { key: 'sizeChart', label: 'Size guide' },
      { key: 'care', label: 'Care instructions' },
    ],
  },
};
const key = (v: string) => v.toLowerCase().replace(/\s+/g, '-');
export function getCategoryConfig(category: Product['category']): CategoryConfig {
  for (const candidate of [category.id, category.name, ...category.path.slice().reverse()]) {
    const match = Object.entries(categoryConfig).find(
      ([id, config]) => id === key(candidate) || config.aliases?.includes(key(candidate)),
    );
    if (match) return match[1];
  }
  return defaults;
}
