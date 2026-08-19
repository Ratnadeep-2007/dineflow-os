// ─── Conversation states ───────────────────────────────────────
export const STATES = {
  IDLE: 'IDLE',
  AWAITING_ORDER_TYPE: 'AWAITING_ORDER_TYPE',

  // Dine-In flow
  DINE_IN_MENU: 'DINE_IN_MENU',
  DINE_IN_PARTY_SIZE: 'DINE_IN_PARTY_SIZE',
  DINE_IN_CONFIRM: 'DINE_IN_CONFIRM',

  // Takeaway flow
  TAKEAWAY_MENU: 'TAKEAWAY_MENU',
  TAKEAWAY_CONFIRM: 'TAKEAWAY_CONFIRM',

  // Delivery flow
  DELIVERY_PLATFORM: 'DELIVERY_PLATFORM',

  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  COMPLETED: 'COMPLETED',
} as const;

export type State = (typeof STATES)[keyof typeof STATES];

// ─── Callback data strings (must be short — Telegram 64 byte limit) ──
export const CB = {
  ORDER_DINE_IN:   'o:dine',
  ORDER_TAKEAWAY:  'o:take',
  ORDER_DELIVERY:  'o:deliv',

  PLATFORM_ZOMATO:  'p:zom',
  PLATFORM_SWIGGY:  'p:swi',
  PLATFORM_DINEOUT: 'p:din',

  MENU_CAT_PREFIX: 'mc:',   // e.g. mc:Burgers
  ITEM_PREFIX:     'mi:',   // e.g. mi:item_001
  CHECKOUT:        'cart:checkout',
  CONFIRM:         'cart:confirm',
  CANCEL:          'cart:cancel',
  RESET:           'sys:reset',
} as const;

// ─── Menu data ────────────────────────────────────────────────
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji: string;
  imageUrl?: string;
  inStock: boolean;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'm1',
    name: 'Truffle Smash Burger',
    description: 'Double Angus beef patties, truffle mayo, caramelized onions & Swiss cheese',
    price: 349,
    category: 'Burgers',
    emoji: '🍔',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm2',
    name: 'Fiery Peri-Peri Chicken Burger',
    description: 'Crispy fried chicken breast, spicy peri-peri glaze, jalapeño slaw',
    price: 299,
    category: 'Burgers',
    emoji: '🍔',
    imageUrl: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm3',
    name: 'Smoky BBQ Bacon Cheeseburger',
    description: 'Prime beef patty, hickory BBQ, applewood bacon, aged cheddar',
    price: 369,
    category: 'Burgers',
    emoji: '🍔',
    imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm4',
    name: 'Crispy Veggie Avocado Burger',
    description: 'Quinoa & edamame crisp patty, fresh Haas guacamole, vegan herb mayo',
    price: 269,
    category: 'Burgers',
    emoji: '🍔',
    imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm5',
    name: 'Artisanal Mushroom & Truffle Pizza',
    description: 'Sourdough crust, wild forest mushrooms, fior di latte, white truffle oil',
    price: 499,
    category: 'Pizza',
    emoji: '🍕',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm6',
    name: 'Classic Margherita Classica',
    description: 'San Marzano tomato coulis, buffalo mozzarella, fresh sweet basil',
    price: 389,
    category: 'Pizza',
    emoji: '🍕',
    imageUrl: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm7',
    name: 'Pepperoni Piccante Feast',
    description: 'Double beef pepperoni, calabrian chili oil, mozzarella & oregano',
    price: 529,
    category: 'Pizza',
    emoji: '🍕',
    imageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm8',
    name: 'Paneer Tikka Charcoal Wrap',
    description: 'Char-grilled cottage cheese tikka, mint chutney, pickled onions in flaky paratha',
    price: 249,
    category: 'Wraps',
    emoji: '🌯',
    imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm9',
    name: 'Smoky Chicken Shawarma Wrap',
    description: 'Pulled spiced chicken, garlic toum, crispy fries, pickled cucumbers',
    price: 279,
    category: 'Wraps',
    emoji: '🌯',
    imageUrl: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm10',
    name: 'Loaded Queso & Jalapeño Fries',
    description: 'Crispy fries, hot cheddar queso, pico de gallo, pickled jalapeños',
    price: 189,
    category: 'Starters',
    emoji: '🍟',
    imageUrl: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm11',
    name: 'Crispy Korean Gochujang Wings',
    description: 'Double-fried wings, sticky gochujang glaze, toasted sesame (6 pcs)',
    price: 319,
    category: 'Starters',
    emoji: '🍗',
    imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm13',
    name: 'Belgian Chocolate Hazelnut Shake',
    description: 'Belgian dark chocolate, Nutella, whipped cream & roasted hazelnuts',
    price: 179,
    category: 'Drinks',
    emoji: '🥤',
    imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm16',
    name: 'Hot Salted Caramel Churros',
    description: 'Crispy Spanish churros, cinnamon sugar, warm salted caramel dip',
    price: 219,
    category: 'Desserts',
    emoji: '🍩',
    imageUrl: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
  {
    id: 'm17',
    name: 'Warm Molten Lava Cake',
    description: 'Valrhona dark chocolate sponge, molten core, vanilla bean gelato',
    price: 249,
    category: 'Desserts',
    emoji: '🍰',
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&auto=format&fit=crop&q=80',
    inStock: true,
  },
];

// ─── Cart + session ───────────────────────────────────────────
export interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface UserSession {
  state: State;
  orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  partySize?: number;
  cart: CartItem[];
  menuToken?: string;
  createdAt: number;
  firstName?: string;
  telegramId: number;
}

export const SESSION_TTL = 30 * 60; // 30 min
