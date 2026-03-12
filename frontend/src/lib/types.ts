export interface KgProduct {
  id: string;
  name: string;
  description?: string;
  pricePerKg: string;
  isAvailable: boolean;
  category?: { id: string; name: string } | null;
}

export interface KgOrderItem {
  id: string;
  productId: string;
  weightKg: string;
  pricePerKg: string;
  subtotal: string;
  notes?: string | null;
  product: { id: string; name: string; pricePerKg: string };
}

export interface KgOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  isDelivery: boolean;
  deliveryAddress?: string | null;
  deliveryPhone?: string | null;
  isSentToKitchen: boolean;
  status: "PENDING" | "WEIGHED" | "PAID" | "DELIVERED" | "CANCELLED";
  totalPrice: string;
  totalAmount: string;
  notes?: string | null;
  createdAt: string;
  items: KgOrderItem[];
  source?: "LOCAL" | "WHATSAPP";
  waJid?: string | null;
}

export interface ActiveShift {
  id: string;
  openedAt: string;
  initialCash: number;
  status: "OPEN" | "CLOSED";
  openedBy?: string;
  notes?: string | null;
}

// ─── TIPOS UNIFICADOS (Order y Expense) ──────────────────────────────────────

export interface OrderItem {
  id: string;
  productId: string;
  unitType: "UNIT" | "KG" | "PORTION";
  quantity: string;
  unitPrice: string;
  subtotal: string;
  notes?: string | null;
  product: { id: string; name: string; pricePerKg?: string; price?: string };
}

export interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  isDelivery: boolean;
  deliveryAddress?: string | null;
  deliveryPhone?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  paymentMethod: string;
  cadetePaidAmount: string;
  isSentToKitchen: boolean;
  status: "PENDING" | "IN_PROGRESS" | "READY" | "DELIVERED" | "CANCELLED";
  totalPrice: string;
  notes?: string | null;
  createdAt: string;
  items: OrderItem[];
  source: "LOCAL" | "WHATSAPP";
  waJid?: string | null;
  customerId?: string | null;
  cadeteId?: string | null;
  userId?: string | null;
}

export interface Expense {
  id: string;
  type: "CASH" | "STRUCTURAL" | "SUPPLIES";
  category?: string | null;
  description: string;
  amount: string;
  currency: string;
  period?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  isPaid: boolean;
  notes?: string | null;
  createdAt: string;
  shiftId?: string | null;
  userId?: string | null;
}
