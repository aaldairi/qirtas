export type OrderStatus = "PENDING" | "REVIEW" | "PAID" | "REJECTED";
export type PaymentMethod = "iban" | "wallet" | "cash";
export type Fulfilment = "pickup" | "delivery";
export type Plan = "starter" | "growth" | "stores";

export type Shop = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  owner_name: string | null;
  plan: Plan;
  iban_on: boolean;
  iban_value: string | null;
  wallet_on: boolean;
  wallet_value: string | null;
  cash_on: boolean;
  cash_value: string | null;
  pickup_on: boolean;
  delivery_on: boolean;
  delivery_fee: number;
  whatsapp: string | null;
  order_seq: number;
  created_at: string;
};

export type Category = {
  id: string;
  shop_id: string;
  name: string;
  sort: number;
};

export type Variant = {
  id: string;
  product_id: string;
  label: string;
  qty: number;
  sort: number;
};

export type Product = {
  id: string;
  shop_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  track_stock: boolean;
  description: string | null;
  image_path: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductWithVariants = Product & {
  product_variants: Variant[];
  categories?: { id: string; name: string } | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  variant_label: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type Order = {
  id: string;
  shop_id: string;
  code: string;
  public_token: string;
  customer_name: string;
  customer_phone: string;
  fulfilment: Fulfilment;
  delivery_fee: number;
  payment_method: PaymentMethod;
  payment_detail: string | null;
  status: OrderStatus;
  subtotal: number;
  total: number;
  receipt_path: string | null;
  receipt_name: string | null;
  receipt_size: number | null;
  receipt_at: string | null;
  decided_at: string | null;
  note: string | null;
  created_at: string;
};

export type OrderWithItems = Order & { order_items: OrderItem[] };

/** A line the customer is buying, as held in the cart cookie. */
export type CartLine = {
  productId: string;
  variant: string | null;
  qty: number;
};
