/** Collage-style category / theme taxonomy used across filters and data parsing */

export const CATEGORY_ORDER = ['Fashion', 'Home', 'Seasonal', 'Holiday', 'Other'] as const;

export type TopCategory = (typeof CATEGORY_ORDER)[number];

/** Level-2 themes under each level-1 category (display order preserved) */
export const THEME_TAXONOMY: Record<TopCategory, readonly string[]> = {
  Fashion: [
    'Casual', 'Old Money', 'Vacation', 'Western', 'Boho', 'Formal', 'Athletic',
    'Denim', 'Lace', 'Polka Dot', 'Stripe', 'Gingham', 'Paisley', 'Leopard',
    'Coastal', 'Party', 'Collection',
  ],
  Home: [
    'Bathroom', 'Bedroom', 'Laundry Room', 'Living Room', 'Kitchen', 'Yard',
    'Office', 'General', 'Cleaning', 'Tool', 'Vanity', 'Appliance', 'Sort',
    'Collection', 'Decoration',
  ],
  Seasonal: ['Spring', 'Summer', 'Fall', 'Winter'],
  Holiday: [
    'Valentines', 'Galentines', 'Christmas', 'Black Friday', 'Memorial Day',
    'Wedding', 'Deal', "Mother's Day",
  ],
  Other: ['Pet', 'Toy', '3C', 'Personal Care', 'Single Product', 'Collection'],
};

/** Keyword variants for matching raw sheet values → subcategory */
export const THEME_KEYWORDS: Record<string, Record<string, string[]>> = {
  Fashion: {
    'Casual': ['casual'],
    'Old Money': ['oldmoney', 'old money'],
    'Vacation': ['vacation', 'resort'],
    'Western': ['western'],
    'Boho': ['boho', 'bohemian'],
    'Formal': ['formal'],
    'Athletic': ['athletic', 'athleisure', 'sporty', 'activewear'],
    'Denim': ['denim'],
    'Lace': ['lace'],
    'Polka Dot': ['polkadot', 'polka dot', 'polka'],
    'Stripe': ['stripe', 'stripes', 'striped'],
    'Gingham': ['gingham'],
    'Paisley': ['paisley'],
    'Leopard': ['leopard', 'animalprint', 'animal print'],
    'Coastal': ['coastal', 'beach'],
    'Party': ['party'],
    'Collection': ['collection', 'collections'],
  },
  Home: {
    'Bathroom': ['bathroom', 'bath'],
    'Bedroom': ['bedroom'],
    'Laundry Room': ['laundryroom', 'laundry room', 'laundry'],
    'Living Room': ['livingroom', 'living room', 'living'],
    'Kitchen': ['kitchen'],
    'Yard': ['yard', 'garden', 'outdoor', 'patio'],
    'Office': ['office', 'homeoffice', 'home office'],
    'General': ['general'],
    'Cleaning': ['cleaning', 'clean'],
    'Tool': ['tool', 'tools'],
    'Vanity': ['vanity'],
    'Appliance': ['appliance', 'appliances'],
    'Sort': ['sort', 'organize', 'organization'],
    'Collection': ['collection', 'collections'],
    'Decoration': ['decoration', 'decor', 'decorative'],
  },
  Seasonal: {
    'Spring': ['spring'],
    'Summer': ['summer'],
    'Fall': ['fall', 'autumn'],
    'Winter': ['winter'],
  },
  Holiday: {
    'Valentines': ['valentine', 'valentines', "valentine's", 'valentinesday'],
    'Galentines': ['galentine', 'galentines'],
    'Christmas': ['christmas', 'xmas'],
    'Black Friday': ['blackfriday', 'black friday'],
    'Memorial Day': ['memorial', 'memorialday', 'memorial day'],
    'Wedding': ['wedding', 'weddings', 'bridal'],
    'Deal': ['deal', 'deals', 'sale'],
    "Mother's Day": ['mothersday', "mother's day", 'mothers day', 'mom'],
  },
  Other: {
    'Pet': ['pet', 'pets'],
    'Toy': ['toy', 'toys'],
    '3C': ['3c', 'electronics', 'gadget'],
    'Personal Care': ['personalcare', 'personal care', 'beauty', 'makeup', 'skincare'],
    'Single Product': ['singleproduct', 'single product', 'single'],
    'Collection': ['collection', 'collections', 'bundle'],
  },
};

export const CATEGORY_SYNONYMS: Record<string, TopCategory> = {
  'seasonal': 'Seasonal',
  'holiday': 'Holiday',
  'holidays': 'Holiday',
  'other': 'Other',
  'misc': 'Other',
  'fashion': 'Fashion',
  'apparel': 'Fashion',
  'clothing': 'Fashion',
  'accessories': 'Fashion',
  'home': 'Home',
  'homegoods': 'Home',
  'home goods': 'Home',
};

/** Full theme path for filtering, e.g. "Fashion/Casual" */
export const toThemePath = (category: TopCategory, sub: string): string => `${category}/${sub}`;

/** All theme paths in taxonomy order */
export const ALL_THEME_PATHS: string[] = CATEGORY_ORDER.flatMap(cat =>
  THEME_TAXONOMY[cat].map(sub => toThemePath(cat, sub))
);
