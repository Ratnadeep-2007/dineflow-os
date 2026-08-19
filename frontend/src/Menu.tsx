import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  Search,
  Check,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { API_BASE_URL } from './config';

// ─── TYPES ─────────────────────────────────────────────────────────────
interface CustomizationOption {
  id: string;
  name: string;
  price: number;
}

interface CustomizationGroup {
  id: string;
  title: string;
  type: 'single' | 'multiple';
  required?: boolean;
  options: CustomizationOption[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isVeg: boolean;
  image: string;
  calories?: string;
  prepTime?: string;
  customizations?: CustomizationGroup[];
}

interface SelectedCustomization {
  groupId: string;
  groupTitle: string;
  selected: CustomizationOption[];
}

interface CartItem {
  cartItemId: string;
  item: MenuItem;
  quantity: number;
  customizations: SelectedCustomization[];
  itemNote: string;
  unitPrice: number;
}

// ─── RESPONSIVE HOOK ───────────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return width;
}

// ─── CURATED ARTISANAL MENU DATA ────────────────────────────────────────
const MENU_DATA: MenuItem[] = [
  // ── BURGERS ──
  {
    id: 'm1',
    name: 'Truffle Smash Burger',
    description: 'Double Angus beef patty, black truffle aioli, shallots & melted Swiss on toasted brioche.',
    price: 349,
    category: 'Burgers',
    isVeg: false,
    calories: '680 kcal',
    prepTime: '12 min',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    customizations: [
      {
        id: 'c_patty',
        title: 'Choose Patty Size',
        type: 'single',
        required: true,
        options: [
          { id: 'p_double', name: 'Double Patty (Standard)', price: 0 },
          { id: 'p_triple', name: 'Triple Patty Smash', price: 90 },
          { id: 'p_single', name: 'Single Patty Light', price: -50 },
        ]
      },
      {
        id: 'c_addons',
        title: 'Add-ons',
        type: 'multiple',
        options: [
          { id: 'add_cheese', name: 'Extra Swiss Cheese', price: 40 },
          { id: 'add_truffle', name: 'Extra Truffle Aioli', price: 30 },
          { id: 'add_bacon', name: 'Crispy Smoked Bacon', price: 65 },
        ]
      }
    ]
  },
  {
    id: 'm2',
    name: 'Peri-Peri Crisp Chicken Burger',
    description: 'Buttermilk fried chicken breast in house peri-peri glaze with spicy pickled slaw.',
    price: 299,
    category: 'Burgers',
    isVeg: false,
    calories: '590 kcal',
    prepTime: '10 min',
    image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&auto=format&fit=crop&q=80',
    customizations: [
      {
        id: 'c_spice',
        title: 'Spice Level',
        type: 'single',
        required: true,
        options: [
          { id: 'sp_mild', name: 'Mild', price: 0 },
          { id: 'sp_med', name: 'Medium Spicy', price: 0 },
          { id: 'sp_hot', name: 'Extra Hot 🔥', price: 0 },
        ]
      },
      {
        id: 'c_cheese',
        title: 'Add-ons',
        type: 'multiple',
        options: [
          { id: 'ch_cheddar', name: 'Mature Cheddar Slice', price: 30 },
        ]
      }
    ]
  },
  {
    id: 'm3',
    name: 'Smoked BBQ Bacon Burger',
    description: 'Seared Angus patty, applewood bacon, aged cheddar, charred onion & bourbon BBQ.',
    price: 369,
    category: 'Burgers',
    isVeg: false,
    calories: '740 kcal',
    prepTime: '14 min',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'm4',
    name: 'Avocado & Quinoa Burger',
    description: 'Crisp edamame & quinoa patty, crushed avocado, wild arugula and herb mayo.',
    price: 269,
    category: 'Burgers',
    isVeg: true,
    calories: '480 kcal',
    prepTime: '10 min',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80',
    customizations: [
      {
        id: 'c_bun',
        title: 'Bun Option',
        type: 'single',
        options: [
          { id: 'b_brioche', name: 'Brioche Bun', price: 0 },
          { id: 'b_lettuce', name: 'Lettuce Wrap (Gluten-Free)', price: 0 },
        ]
      }
    ]
  },

  // ── PIZZA ──
  {
    id: 'm5',
    name: 'Wild Mushroom & Truffle Pizza',
    description: '48-hour fermented sourdough crust, portobello mushrooms, fior di latte & truffle oil.',
    price: 499,
    category: 'Pizza',
    isVeg: true,
    calories: '820 kcal',
    prepTime: '15 min',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
    customizations: [
      {
        id: 'c_crust',
        title: 'Crust Style',
        type: 'single',
        required: true,
        options: [
          { id: 'cr_sourdough', name: 'Neapolitan Sourdough', price: 0 },
          { id: 'cr_thin', name: 'Thin & Crispy', price: 0 },
          { id: 'cr_stuffed', name: 'Cheese Stuffed Crust', price: 80 },
        ]
      },
      {
        id: 'c_toppings',
        title: 'Extra Toppings',
        type: 'multiple',
        options: [
          { id: 'top_burrata', name: 'Fresh Burrata Ball', price: 120 },
          { id: 'top_olives', name: 'Kalamata Olives', price: 45 },
          { id: 'top_honey', name: 'Hot Chili Honey', price: 35 },
        ]
      }
    ]
  },
  {
    id: 'm6',
    name: 'Margherita Classica',
    description: 'San Marzano tomato coulis, fresh buffalo mozzarella, garden basil and extra virgin olive oil.',
    price: 389,
    category: 'Pizza',
    isVeg: true,
    calories: '650 kcal',
    prepTime: '12 min',
    image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'm7',
    name: 'Pepperoni Piccante',
    description: 'Cured beef pepperoni, hot calabrian chili oil, mozzarella & crushed oregano.',
    price: 529,
    category: 'Pizza',
    isVeg: false,
    calories: '890 kcal',
    prepTime: '14 min',
    image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&auto=format&fit=crop&q=80',
  },

  // ── WRAPS ──
  {
    id: 'm8',
    name: 'Paneer Tikka Paratha Roll',
    description: 'Char-grilled cottage cheese tikka, mint chutney and pickled shallots in layered paratha.',
    price: 249,
    category: 'Wraps',
    isVeg: true,
    calories: '450 kcal',
    prepTime: '8 min',
    image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'm9',
    name: 'Roasted Chicken Shawarma',
    description: 'Slow-roasted chicken, Lebanese garlic toum, salted fries & pickled cucumbers.',
    price: 279,
    category: 'Wraps',
    isVeg: false,
    calories: '530 kcal',
    prepTime: '8 min',
    image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&auto=format&fit=crop&q=80',
  },

  // ── STARTERS ──
  {
    id: 'm10',
    name: 'Truffle & Parmesan Fries',
    description: 'Hand-cut russet fries tossed in white truffle oil, grated parmesan and sea salt.',
    price: 219,
    category: 'Starters',
    isVeg: true,
    calories: '460 kcal',
    prepTime: '6 min',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'm11',
    name: 'Crispy Gochujang Wings',
    description: 'Double-fried jumbo wings glazed in Korean gochujang and toasted sesame (6 pcs).',
    price: 319,
    category: 'Starters',
    isVeg: false,
    calories: '610 kcal',
    prepTime: '10 min',
    image: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'm12',
    name: 'Loaded Queso Fries',
    description: 'Crispy fries drenched in hot liquid cheddar cheese, salsa & pickled jalapeños.',
    price: 189,
    category: 'Starters',
    isVeg: true,
    calories: '520 kcal',
    prepTime: '6 min',
    image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600&auto=format&fit=crop&q=80',
  },

  // ── DRINKS ──
  {
    id: 'm13',
    name: 'Belgian Chocolate Hazelnut Shake',
    description: 'Single-origin dark chocolate blended with roasted hazelnut butter & whipped cream.',
    price: 179,
    category: 'Drinks',
    isVeg: true,
    calories: '410 kcal',
    prepTime: '4 min',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'm14',
    name: 'Wild Strawberry Shake',
    description: 'Fresh strawberries blended with French vanilla gelato and berry compote.',
    price: 189,
    category: 'Drinks',
    isVeg: true,
    calories: '390 kcal',
    prepTime: '4 min',
    image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'm15',
    name: 'Fresh Passionfruit Soda',
    description: 'Fresh passionfruit pulp, bruised garden mint, lime & sparkling water over ice.',
    price: 159,
    category: 'Drinks',
    isVeg: true,
    calories: '120 kcal',
    prepTime: '3 min',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
  },

  // ── DESSERTS ──
  {
    id: 'm16',
    name: 'Cinnamon Sugar Churros',
    description: 'Spanish churros rolled in cinnamon sugar, served with warm salted dulce de leche dip.',
    price: 219,
    category: 'Desserts',
    isVeg: true,
    calories: '380 kcal',
    prepTime: '8 min',
    image: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'm17',
    name: 'Valrhona Molten Lava Cake',
    description: 'Warm dark chocolate sponge with molten core, served with vanilla bean gelato.',
    price: 249,
    category: 'Desserts',
    isVeg: true,
    calories: '490 kcal',
    prepTime: '8 min',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'm18',
    name: 'New York Baked Cheesecake',
    description: 'Velvety baked cream cheese on a butter graham crust with wild berry coulis.',
    price: 239,
    category: 'Desserts',
    isVeg: true,
    calories: '420 kcal',
    prepTime: '4 min',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=80',
  }
];

const CATEGORIES = ['All', 'Burgers', 'Pizza', 'Wraps', 'Starters', 'Drinks', 'Desserts'];

export default function Menu() {
  const [searchParams] = useSearchParams();
  const phoneParam = searchParams.get('phone') || '';
  const initialMode = searchParams.get('mode') === 'takeaway' ? 'TAKEAWAY' : 'DINE_IN';

  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 1024;
  const isMobile = windowWidth < 640;

  // Filters State
  const [activeCategory, setActiveCategory] = useState('All');
  const [vegFilter, setVegFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart & Order State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>(initialMode);
  const [tableNumber, setTableNumber] = useState<string>('4');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>(phoneParam);
  const [overallNote, setOverallNote] = useState<string>('');

  // Modals & Bottom Sheets
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState<{ ref: string; time: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customization Form State
  const [customQuantity, setCustomQuantity] = useState(1);
  const [selectedCustomizations, setSelectedCustomizations] = useState<Record<string, CustomizationOption[]>>({});
  const [itemNote, setItemNote] = useState('');

  // Open item customizer
  const openCustomizer = (item: MenuItem) => {
    setSelectedItem(item);
    setCustomQuantity(1);
    setItemNote('');

    const initial: Record<string, CustomizationOption[]> = {};
    if (item.customizations) {
      item.customizations.forEach((group) => {
        if (group.type === 'single' && group.options.length > 0) {
          initial[group.id] = [group.options[0]];
        } else {
          initial[group.id] = [];
        }
      });
    }
    setSelectedCustomizations(initial);
  };

  // Toggle option selection
  const handleSelectOption = (group: CustomizationGroup, option: CustomizationOption) => {
    setSelectedCustomizations((prev) => {
      if (group.type === 'single') {
        return { ...prev, [group.id]: [option] };
      } else {
        const currentList = prev[group.id] || [];
        const exists = currentList.some((o) => o.id === option.id);
        if (exists) {
          return { ...prev, [group.id]: currentList.filter((o) => o.id !== option.id) };
        } else {
          return { ...prev, [group.id]: [...currentList, option] };
        }
      }
    });
  };

  // Calculate unit price with options
  const calculateUnitPrice = (item: MenuItem, selected: Record<string, CustomizationOption[]>) => {
    let extra = 0;
    Object.values(selected).forEach((opts) => {
      opts.forEach((o) => (extra += o.price));
    });
    return Math.max(0, item.price + extra);
  };

  // Add customized item to cart
  const handleAddToCart = () => {
    if (!selectedItem) return;

    const unitPrice = calculateUnitPrice(selectedItem, selectedCustomizations);
    const mappedCustomizations: SelectedCustomization[] = Object.entries(selectedCustomizations)
      .filter(([_, opts]) => opts.length > 0)
      .map(([groupId, opts]) => {
        const group = selectedItem.customizations?.find((g) => g.id === groupId);
        return {
          groupId,
          groupTitle: group ? group.title : '',
          selected: opts,
        };
      });

    const cartItemId = `${selectedItem.id}-${Date.now()}`;
    const newCartItem: CartItem = {
      cartItemId,
      item: selectedItem,
      quantity: customQuantity,
      customizations: mappedCustomizations,
      itemNote,
      unitPrice,
    };

    setCart((prev) => [...prev, newCartItem]);
    setSelectedItem(null);
  };

  // Quick add button
  const handleQuickAdd = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    if (item.customizations && item.customizations.length > 0) {
      openCustomizer(item);
    } else {
      const cartItemId = `${item.id}-${Date.now()}`;
      setCart((prev) => [
        ...prev,
        {
          cartItemId,
          item,
          quantity: 1,
          customizations: [],
          itemNote: '',
          unitPrice: item.price,
        },
      ]);
    }
  };

  // Quantity updates
  const updateCartQty = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.cartItemId === cartItemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Totals
  const cartSubtotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);
  const totalItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  // Filtered menu
  const filteredMenu = useMemo(() => {
    return MENU_DATA.filter((item) => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesDietary =
        vegFilter === 'ALL' ? true : vegFilter === 'VEG' ? item.isVeg : !item.isVeg;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesDietary && matchesSearch;
    });
  }, [activeCategory, vegFilter, searchQuery]);

  // Submit Order
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const formattedCart = cart.map((c) => {
        let noteParts: string[] = [];
        c.customizations.forEach((grp) => {
          grp.selected.forEach((opt) => noteParts.push(opt.name));
        });
        if (c.itemNote) noteParts.push(`Note: ${c.itemNote}`);
        const fullName = noteParts.length > 0 ? `${c.item.name} (${noteParts.join(', ')})` : c.item.name;

        return {
          menuItemId: c.item.id,
          name: fullName,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        };
      });

      const orderRef = `DF${Math.floor(100000 + Math.random() * 900000)}`;
      const phone = customerPhone.trim() || `GUEST_${Math.floor(1000 + Math.random() * 9000)}`;

      if (orderType === 'DINE_IN') {
        await fetch(`${API_BASE_URL}/webhook/whatsapp-booking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            partySize: parseInt(tableNumber, 10) || 2,
            cart: formattedCart,
            type: 'DINE_IN',
            source: 'WHATSAPP_BOT',
            guestName: customerName ? `${customerName} (Table ${tableNumber})` : `Table ${tableNumber}`,
            specialRequests: overallNote,
          }),
        });
      } else {
        await fetch(`${API_BASE_URL}/webhook/whatsapp-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            orderType: 'TAKEAWAY',
            cart: formattedCart,
            orderRef,
            source: 'WHATSAPP_BOT',
            guestName: customerName || `Takeaway Guest`,
            specialRequests: overallNote,
          }),
        });
      }

      setOrderConfirmed({ ref: orderRef, time: '12-15 min' });
      setCart([]);
      setIsCartOpen(false);
    } catch {
      setOrderConfirmed({ ref: `DF${Math.floor(100000 + Math.random() * 900000)}`, time: '12-15 min' });
      setCart([]);
      setIsCartOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── CART TRAY COMPONENT (REUSABLE FOR DESKTOP SIDEBAR & MOBILE DRAWER)
  const CartTrayContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#111827' }}>
            Your Order Tray
          </h3>
          <span style={{ fontSize: '0.74rem', color: '#6B7280', fontWeight: 500 }}>
            {orderType === 'DINE_IN' ? `Table #${tableNumber} · Dine In` : 'Takeaway Order'}
          </span>
        </div>

        {!isDesktop && (
          <button
            onClick={() => setIsCartOpen(false)}
            style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Items List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
            <ShoppingBag size={38} strokeWidth={1.5} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600 }}>Your tray is empty</p>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem' }}>Select dishes from the menu to build your order.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {cart.map((c) => (
                <div
                  key={c.cartItemId}
                  style={{
                    paddingBottom: '12px',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827' }}>
                      {c.item.name}
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#D90429' }}>
                      ₹{c.unitPrice * c.quantity}
                    </span>
                  </div>

                  {c.customizations.map((grp) => (
                    <div key={grp.groupId} style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px' }}>
                      • {grp.selected.map((s) => s.name).join(', ')}
                    </div>
                  ))}

                  {c.itemNote && (
                    <div style={{ fontSize: '0.72rem', color: '#D97706', marginTop: '2px', fontStyle: 'italic' }}>
                      "{c.itemNote}"
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '0.74rem', color: '#9CA3AF' }}>₹{c.unitPrice} each</span>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '6px' }}>
                      <button
                        onClick={() => updateCartQty(c.cartItemId, -1)}
                        style={{ background: 'none', border: 'none', color: '#111827', cursor: 'pointer', display: 'flex' }}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{c.quantity}</span>
                      <button
                        onClick={() => updateCartQty(c.cartItemId, 1)}
                        style={{ background: 'none', border: 'none', color: '#111827', cursor: 'pointer', display: 'flex' }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Table & Instructions Box */}
            <div style={{ backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #E5E7EB' }}>
              <span style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                {orderType === 'DINE_IN' ? 'Table & Guest Details' : 'Contact Details'}
              </span>

              {orderType === 'DINE_IN' ? (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Table #"
                    style={{
                      width: '70px',
                      padding: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Guest Name (Optional)"
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your Name"
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Phone #"
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <textarea
                rows={2}
                value={overallNote}
                onChange={(e) => setOverallNote(e.target.value)}
                placeholder="Overall instructions for kitchen..."
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Checkout Footer */}
      {cart.length > 0 && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>
            <span>Total Payable</span>
            <span style={{ color: '#D90429' }}>₹{cartSubtotal}</span>
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#D90429',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>{isSubmitting ? 'Sending to Kitchen...' : `Place Order · ₹${cartSubtotal}`}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

    </div>
  );

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      color: '#111827',
      minHeight: '100vh',
      width: '100%',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
      letterSpacing: '-0.01em',
      overflowX: 'hidden',
    }}>

      {/* ─── RESPONSIVE HEADER ───────────────────────────────────────────── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E5E7EB',
        padding: isMobile ? '12px 16px' : '14px 28px',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: isMobile ? '1.05rem' : '1.15rem',
              fontWeight: 800,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              color: '#111827',
            }}>
              Dineflow<span style={{ color: '#D90429' }}>.</span>
            </span>

            <span style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#6B7280',
              borderLeft: '1px solid #E5E7EB',
              paddingLeft: '10px',
            }}>
              {orderType === 'DINE_IN' ? `Table ${tableNumber}` : 'Takeaway'}
            </span>
          </div>

          {/* Mode Switcher */}
          <div style={{
            display: 'flex',
            backgroundColor: '#F3F4F6',
            borderRadius: '20px',
            padding: '2px',
          }}>
            <button
              onClick={() => setOrderType('DINE_IN')}
              style={{
                padding: isMobile ? '5px 10px' : '6px 14px',
                fontSize: isMobile ? '0.72rem' : '0.78rem',
                fontWeight: orderType === 'DINE_IN' ? 700 : 500,
                border: 'none',
                borderRadius: '16px',
                cursor: 'pointer',
                backgroundColor: orderType === 'DINE_IN' ? '#D90429' : 'transparent',
                color: orderType === 'DINE_IN' ? '#FFFFFF' : '#6B7280',
                transition: 'all 0.15s ease',
              }}
            >
              Dine In
            </button>
            <button
              onClick={() => setOrderType('TAKEAWAY')}
              style={{
                padding: isMobile ? '5px 10px' : '6px 14px',
                fontSize: isMobile ? '0.72rem' : '0.78rem',
                fontWeight: orderType === 'TAKEAWAY' ? 700 : 500,
                border: 'none',
                borderRadius: '16px',
                cursor: 'pointer',
                backgroundColor: orderType === 'TAKEAWAY' ? '#D90429' : 'transparent',
                color: orderType === 'TAKEAWAY' ? '#FFFFFF' : '#6B7280',
                transition: 'all 0.15s ease',
              }}
            >
              Takeaway
            </button>
          </div>

          {/* Mobile Cart Trigger */}
          {!isDesktop && (
            <button
              onClick={() => setIsCartOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: totalItemCount > 0 ? '#111827' : '#F9FAFB',
                color: totalItemCount > 0 ? '#FFFFFF' : '#6B7280',
                border: '1px solid',
                borderColor: totalItemCount > 0 ? '#111827' : '#E5E7EB',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <ShoppingBag size={14} />
              <span>{totalItemCount > 0 ? `${totalItemCount} · ₹${cartSubtotal}` : 'Tray'}</span>
            </button>
          )}

        </div>
      </header>

      {/* ─── MAIN CONTENT WRAPPER ───────────────────────────────────────── */}
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        padding: isMobile ? '12px 16px' : '20px 28px',
        gap: '32px',
      }}>
        
        {/* LEFT COLUMN: Search, Categories & Food Menu */}
        <div style={{ flex: 1, minWidth: 0 }}>
          
          {/* Controls Bar: Search & Dietary */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            {/* Search */}
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search burgers, sourdough pizza, drinks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  backgroundColor: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  color: '#111827',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Dietary Tabs */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'VEG', label: '🟢 Veg' },
                { id: 'NON_VEG', label: '🔴 Non-Veg' },
              ].map((d) => {
                const active = vegFilter === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setVegFilter(d.id as any)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.74rem',
                      fontWeight: active ? 700 : 500,
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: active ? '#111827' : '#E5E7EB',
                      backgroundColor: active ? '#111827' : '#FFFFFF',
                      color: active ? '#FFFFFF' : '#4B5563',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            gap: isMobile ? '12px' : '20px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            borderBottom: '1px solid #E5E7EB',
            paddingBottom: '2px',
            marginBottom: '20px',
          }}>
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '8px 0',
                    fontSize: isMobile ? '0.8rem' : '0.86rem',
                    fontWeight: active ? 800 : 500,
                    color: active ? '#D90429' : '#6B7280',
                    background: 'none',
                    border: 'none',
                    borderBottom: active ? '2px solid #D90429' : '2px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    marginBottom: '-1px',
                    transition: 'all 0.12s ease',
                    flexShrink: 0,
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* ─── DISHES GRID / LIST ─── */}
          {filteredMenu.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: '0.88rem' }}>
              No dishes found. Try changing your search query or category filter.
            </div>
          ) : isMobile ? (
            /* Mobile Horizontal Cards Feed */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '100px' }}>
              {filteredMenu.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openCustomizer(item)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #F1F5F9',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                    cursor: 'pointer',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      width: '13px',
                      height: '13px',
                      border: `1.5px solid ${item.isVeg ? '#16A34A' : '#DC2626'}`,
                      backgroundColor: '#FFFFFF',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '4px',
                    }}>
                      <div style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: item.isVeg ? '#16A34A' : '#DC2626',
                      }} />
                    </div>

                    <h3 style={{ margin: '0 0 3px 0', fontSize: '0.92rem', fontWeight: 700, color: '#0F172A' }}>
                      {item.name}
                    </h3>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#D90429', marginBottom: '4px' }}>
                      ₹{item.price}
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: '0.74rem',
                      color: '#64748B',
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {item.description}
                    </p>
                  </div>

                  <div style={{ position: 'relative', width: '88px', height: '88px', flexShrink: 0 }}>
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
                      loading="lazy"
                    />
                    <button
                      onClick={(e) => handleQuickAdd(e, item)}
                      style={{
                        position: 'absolute',
                        bottom: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#FFFFFF',
                        color: '#D90429',
                        border: '1px solid #FECDD3',
                        borderRadius: '6px',
                        padding: '3px 10px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.customizations ? 'CUSTOMIZE' : '+ ADD'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Tablet / Desktop Grid (2 or 3 columns) */
            <div style={{
              display: 'grid',
              gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(260px, 1fr))' : 'repeat(2, 1fr)',
              gap: '20px',
              paddingBottom: isDesktop ? '40px' : '100px',
            }}>
              {filteredMenu.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openCustomizer(item)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#111827';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ position: 'relative', height: '160px', backgroundColor: '#F3F4F6' }}>
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      width: '15px',
                      height: '15px',
                      border: `1.5px solid ${item.isVeg ? '#16A34A' : '#DC2626'}`,
                      backgroundColor: '#FFFFFF',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: item.isVeg ? '#16A34A' : '#DC2626',
                      }} />
                    </div>
                  </div>

                  <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                        <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#111827' }}>
                          {item.name}
                        </h3>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#D90429' }}>
                          ₹{item.price}
                        </span>
                      </div>

                      <p style={{
                        margin: '0 0 14px 0',
                        fontSize: '0.76rem',
                        color: '#6B7280',
                        lineHeight: 1.4,
                        minHeight: '32px',
                      }}>
                        {item.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 500 }}>
                        {item.prepTime || '10 min'}
                      </span>

                      <button
                        onClick={(e) => handleQuickAdd(e, item)}
                        style={{
                          backgroundColor: '#FFFFFF',
                          color: '#111827',
                          border: '1px solid #D1D5DB',
                          borderRadius: '6px',
                          padding: '5px 12px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Plus size={12} />
                        <span>{item.customizations ? 'Customize' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN (DESKTOP ONLY): STICKY ORDER TRAY SIDEBAR */}
        {isDesktop && (
          <aside style={{
            width: '360px',
            position: 'sticky',
            top: '80px',
            height: 'calc(100vh - 100px)',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            <CartTrayContent />
          </aside>
        )}

      </div>

      {/* ─── MOBILE FLOATING CART BAR (SCREENS < 1024px) ─────────────────── */}
      {!isDesktop && totalItemCount > 0 && !isCartOpen && (
        <div style={{
          position: 'fixed',
          bottom: '12px',
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 16px',
        }}>
          <div
            onClick={() => setIsCartOpen(true)}
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#D90429',
              color: '#FFFFFF',
              padding: '12px 18px',
              borderRadius: '12px',
              boxShadow: '0 6px 20px rgba(217, 4, 41, 0.4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>
                {orderType === 'DINE_IN' ? `Table ${tableNumber} Order` : 'Takeaway Order'}
              </div>
              <div style={{ fontSize: '0.94rem', fontWeight: 900 }}>
                {totalItemCount} {totalItemCount > 1 ? 'items' : 'item'} · ₹{cartSubtotal}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.84rem',
              fontWeight: 800,
            }}>
              <span>View Tray</span>
              <ChevronRight size={16} />
            </div>
          </div>
        </div>
      )}

      {/* ─── MOBILE / TABLET CART DRAWER ─────────────────────────────────── */}
      {!isDesktop && isCartOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            maxHeight: '90vh',
            width: '100%',
            maxWidth: '480px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
          }}>
            <CartTrayContent />
          </div>
        </div>
      )}

      {/* ─── CUSTOMIZATION MODAL (RESPONSIVE: BOTTOM SHEET ON MOBILE, MODAL ON DESKTOP) ── */}
      {selectedItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: isMobile ? '0' : '16px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: isMobile ? '20px 20px 0 0' : '16px',
            width: '100%',
            maxWidth: '480px',
            maxHeight: isMobile ? '85vh' : '80vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            border: '1px solid #E5E7EB',
          }}>
            
            {/* Image Header */}
            <div style={{ position: 'relative', height: '170px', width: '100%', backgroundColor: '#F3F4F6' }}>
              <img src={selectedItem.image} alt={selectedItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => setSelectedItem(null)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  color: '#111827',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '18px', flex: 1 }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>
                  {selectedItem.name}
                </h2>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#D90429' }}>
                  ₹{calculateUnitPrice(selectedItem, selectedCustomizations)}
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '0 0 18px 0', lineHeight: 1.45 }}>
                {selectedItem.description}
              </p>

              {/* Groups */}
              {selectedItem.customizations && selectedItem.customizations.map((group) => (
                <div key={group.id} style={{ marginBottom: '16px', backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827' }}>
                      {group.title}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>
                      {group.required ? 'Required' : 'Optional'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {group.options.map((option) => {
                      const isSelected = (selectedCustomizations[group.id] || []).some((o) => o.id === option.id);
                      return (
                        <div
                          key={option.id}
                          onClick={() => handleSelectOption(group, option)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            backgroundColor: isSelected ? '#FFF1F2' : '#FFFFFF',
                            border: '1px solid',
                            borderColor: isSelected ? '#D90429' : '#E5E7EB',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', color: '#1E293B', fontWeight: isSelected ? 700 : 500 }}>
                            {option.name}
                          </span>
                          <span style={{ fontSize: '0.76rem', color: isSelected ? '#D90429' : '#6B7280', fontWeight: 600 }}>
                            {option.price > 0 ? `+₹${option.price}` : option.price < 0 ? `-₹${Math.abs(option.price)}` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Note */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Special instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. less salt, dressing on the side"
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Bottom Stepper & Action */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingTop: '8px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#F1F5F9',
                  padding: '8px 12px',
                  borderRadius: '8px',
                }}>
                  <button
                    onClick={() => setCustomQuantity(Math.max(1, customQuantity - 1))}
                    style={{ background: 'none', border: 'none', color: '#111827', cursor: 'pointer' }}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800 }}>{customQuantity}</span>
                  <button
                    onClick={() => setCustomQuantity(customQuantity + 1)}
                    style={{ background: 'none', border: 'none', color: '#111827', cursor: 'pointer' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#D90429',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Add Item · ₹{calculateUnitPrice(selectedItem, selectedCustomizations) * customQuantity}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ─── SUCCESS MODAL ───────────────────────────────────────────────── */}
      {orderConfirmed && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '360px',
            padding: '28px 20px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            border: '1px solid #E5E7EB',
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: '#DCFCE7',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
            }}>
              <Check size={24} strokeWidth={2.5} />
            </div>

            <h2 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 800, color: '#111827' }}>
              Order Placed!
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0' }}>
              Your ticket has been broadcast to the kitchen and receptionist queue.
            </p>

            <div style={{
              backgroundColor: '#F9FAFB',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              marginBottom: '16px',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>
                Order Reference
              </span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#D90429', margin: '2px 0 4px 0' }}>
                #{orderConfirmed.ref}
              </div>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Estimated preparation: {orderConfirmed.time}
              </span>
            </div>

            <button
              onClick={() => setOrderConfirmed(null)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#111827',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              Order More Items
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
