export interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ShopSettings {
  id?: string;
  currency: string;
  language: string;
  show_prices: boolean;
  show_offers: boolean;
  is_discoverable: boolean;
  show_menus_in_discovery: boolean;
}

export interface ThemeSettings {
  id: string;
  theme: 'light' | 'dark';
  primary_color: string;
  secondary_color: string;
  font_family: string;
  layout: 'grid' | 'list';
  banner_style: 'hero' | 'carousel';
}

export interface Shop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  welcome_message: string | null;
  logo_url: string | null;
  banner_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  opening_time: string | null;
  closing_time: string | null;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  google_review_link: string | null;
  review_widget_code: string | null;
  settings: ShopSettings | null;
  theme: ThemeSettings | null;
  created_at: string;
}

export interface PublicShopListing {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_time: string | null;
  closing_time: string | null;
  active_discounts_count: number;
  best_discount_label?: string | null;
  average_rating?: number | null;
  total_reviews: number;
  show_menus_in_discovery: boolean;
}


export interface Category {
  id: string;
  name: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  item_count: number;
  created_at: string;
}

export interface MenuImage {
  id: string;
  image_url: string;
  thumbnail_url: string | null;
  is_primary: boolean;
  display_order: number;
}

export interface MenuItemVariant {
  name: string;
  price: string;
  offer_price?: string | null;
}

export interface MenuItemAddon {
  name: string;
  price: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: string;
  offer_price: string | null;
  food_type: 'veg' | 'non-veg' | 'egg' | 'drink';
  allow_ice_preference: boolean;
  is_bestseller: boolean;
  is_highlighted: boolean;
  is_available: boolean;
  display_order: number;
  image_url: string | null;
  thumbnail_url: string | null;
  images: MenuImage[];
  variants?: MenuItemVariant[];
  addons?: MenuItemAddon[];
  available_days?: string[];
  available_time_presets?: string[];
  custom_time_from?: string | null;
  custom_time_to?: string | null;
  average_rating?: number | null;
  review_count?: number;
  created_at: string;
}

export interface Review {
  id: string;
  menu_item_id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ReviewSummary {
  average_rating: number;
  total_reviews: number;
  rating_distribution: Record<number, number>;
  reviews: Review[];
}

export interface QRCodeInfo {
  id: string;
  shop_id: string;
  qr_url: string;
  qr_image_url: string | null;
  qr_svg_data: string | null;
  created_at: string;
}

export interface Discount {
  id: string;
  shop_id: string;
  title: string;
  description: string | null;
  discount_type: 'percentage' | 'flat' | 'bogo' | 'combo';
  discount_value: string | null;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  reward_target_ids?: string[] | null;
  applies_to: 'all' | 'category' | 'items';
  target_ids: string[] | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  members_only: boolean;
  created_at: string;
  updated_at: string;
}
