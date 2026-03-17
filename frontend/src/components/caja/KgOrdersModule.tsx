"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Text, Stack, Group, Button, ActionIcon, Divider, Badge, Loader, Center, TextInput, NumberInput, SegmentedControl, Paper, Alert, Textarea, Modal, Tabs, Popover,
} from "@mantine/core";
import Drawer from "@/components/layout/Drawer";
import {
  IconScale, IconPlus, IconMinus, IconTruck, IconHome, IconCash, IconCheck, IconCreditCard, IconQrcode, IconPrinter, IconTrash, IconX, IconAlertTriangle, IconBrandWhatsapp, IconPencil,
} from "@tabler/icons-react";
import { useAuthStore } from "@/store/authStore";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt } from "@/lib/format";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import type { KgProduct } from "@/lib/types";
import DeliveryCommandCenter from "./DeliveryCommandCenter";
import WhatsAppCommandCenter from "./WhatsAppCommandCenter";
import ThermalPrint from "./ThermalPrint";
import CustomerCard from "./CustomerCard";
import CartaSelector from "./CartaSelector";
import styles from "./KgOrdersModule.module.css";

// 1. FIX: Interfaces actualizadas para el modelo híbrido
interface OrderItem {
  productId?: string;
  productName?: string;
  pricePerKg?: number;
  weightKg?: number;
  menuItemId?: string;
  menuItemName?: string;
  price?: number;
  quantity?: number;
  notes?: string;
}

interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  isDelivery: boolean;
  deliveryAddress?: string;
  deliveryPhone?: string;
  isSentToKitchen: boolean;
  isPaid: boolean;
  totalAmount: string;
  totalPrice?: string;
  status: string;
  createdAt: string;
  notes?: string;
  lastPrintedItems?: any;
  user?: { id: string; name: string };
  items: Array<{
    id: string;
    productId: string;
    product: { id: string; name: string; pricePerKg: string; price?: string };
    weightKg?: string;
    quantity?: string;
    subtotal: string;
    notes?: string;
  }>;
}

interface KgOrdersModuleProps {
  shiftId: string;
}

const CAN_LOAD_ORDERS = ["OWNER", "MANAGER", "CASHIER", "TELEFONISTA"];
const CAN_ASSIGN_AND_COLLECT = ["OWNER", "MANAGER", "CASHIER", "ENCARGADO_DELIVERY"];

export default function KgOrdersModule({ shiftId }: KgOrdersModuleProps) {
  const { user } = useAuthStore();
  const canLoadOrders = user && CAN_LOAD_ORDERS.includes(user.role);
  const canAssignAndCollect = user && CAN_ASSIGN_AND_COLLECT.includes(user.role);

  const [activeTab, setActiveTab] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kgOrdersActiveTab') || "lista_general";
    }
    return "lista_general";
  });

  
  const [products, setProducts] = useState<KgProduct[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (activeTab && typeof window !== 'undefined') {
      localStorage.setItem('kgOrdersActiveTab', activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (user?.role === "ENCARGADO_DELIVERY" && (activeTab === "lista_general" || activeTab === "whatsapp")) {
      setActiveTab("delivery");
    }
  }, [user?.role, activeTab]);

  useEffect(() => {
    fetchOrders();
  }, [activeTab]);

  const [isDelivery, setIsDelivery] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "mercadopago" | "tarjeta">("efectivo");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [processingPayment, setProcessingPayment] = useState(false);
  const receivedInputRef = useRef<HTMLInputElement>(null);

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [originalOrderItems, setOriginalOrderItems] = useState<OrderItem[]>([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancellationNote, setCancellationNote] = useState("");
  const [cancellationPin, setCancellationPin] = useState("");
  const [sendToKitchenAfterPay, setSendToKitchenAfterPay] = useState(false);
  const [markAsDeliveredOnPay, setMarkAsDeliveredOnPay] = useState(false);

  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [reprintReason, setReprintReason] = useState("");
  const [pendingOrderUpdate, setPendingOrderUpdate] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [cartaDrawerOpen, setCartaDrawerOpen] = useState(false);

  const [printData, setPrintData] = useState<any>(null);

  // Customer search state
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadedCustomer, setLoadedCustomer] = useState<any>(null);
  const phoneSearchTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/api/products?section=KILO");
      setProducts(res.data.filter((p: KgProduct) => p.isAvailable));
    } catch {
      notifications.show({ title: "Error", message: "No se pudieron cargar los productos", color: "red" });
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // 2. FIX: Apuntamos al endpoint híbrido
  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get(`/api/orders?shiftId=${shiftId}`);
      setOrders(res.data);
    } catch {
      notifications.show({ title: "Error", message: "No se pudieron cargar los pedidos", color: "red" });
    } finally {
      setLoadingOrders(false);
    }
  }, [shiftId]);

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, [fetchProducts, fetchOrders]);

  const updateWeight = (productId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing && existing.weightKg !== undefined) {
        const newWeight = Math.max(0, existing.weightKg + delta);
        if (newWeight === 0) {
          return prev.filter((i) => i.productId !== productId);
        }
        return prev.map((i) =>
          i.productId === productId ? { ...i, weightKg: newWeight } : i
        );
      }
      const product = products.find((p) => p.id === productId);
      if (product && delta > 0) {
        return [...prev, {
          productId: product.id,
          productName: product.name,
          pricePerKg: Number(product.pricePerKg),
          weightKg: delta,
        }];
      }
      return prev;
    });
  };

  const setWeight = (productId: string, weight: number) => {
    if (weight <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, weightKg: weight } : i
        );
      }
      const product = products.find((p) => p.id === productId);
      if (product) {
        return [...prev, {
          productId: product.id,
          productName: product.name,
          pricePerKg: Number(product.pricePerKg),
          weightKg: weight,
        }];
      }
      return prev;
    });
  };

  const handleAddCartaItems = (items: Array<{ productId: string; name: string; price: number; quantity: number }>) => {
    items.forEach((item) => {
      setCart((prev) => {
        const existing = prev.find(i => i.productId === item.productId);
        if (existing) {
          return prev.map(i => 
            i.productId === item.productId 
            ? { ...i, quantity: (i.quantity || 0) + item.quantity }
            : i
          );
        }
        return [
          ...prev,
          {
            productId: item.productId,
            productName: item.name,
            price: item.price,
            quantity: item.quantity,
          },
        ];
      });
    });
  };

  // 3. FIX: Totalizador híbrido que lee kg y unidad
  const total = cart.reduce((acc, item) => {
    const qty = Number(item.quantity ?? item.weightKg ?? 1);
    const price = Number(item.price ?? item.pricePerKg ?? 0);
    return acc + (price * qty);
  }, 0);

  const handleClearForm = () => {
    setEditingOrder(null);
    setCart([]);
    setOriginalOrderItems([]);
    setItemNotes({});
    setCustomerName("");
    setDeliveryAddress("");
    setDeliveryPhone("");
    setIsDelivery(false);
    setSendToKitchenAfterPay(false);
    setLoadedCustomer(null);
    setCustomerSuggestions([]);
    setShowSuggestions(false);
  };

  const handlePhoneChange = (value: string) => {
    setDeliveryPhone(value);
    // Clear customer data when phone changes
    if (loadedCustomer) {
      setCustomerName("");
      setDeliveryAddress("");
      setLoadedCustomer(null);
    }
    // Progressive search
    if (phoneSearchTimer.current) clearTimeout(phoneSearchTimer.current);
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 3) {
      phoneSearchTimer.current = setTimeout(async () => {
        try {
          const res = await api.get(`/api/customers/search?q=${encodeURIComponent(value)}`);
          setCustomerSuggestions(res.data || []);
          setShowSuggestions((res.data || []).length > 0);
        } catch {
          setCustomerSuggestions([]);
          setShowSuggestions(false);
        }
      }, 300);
    } else {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectCustomer = (customer: any) => {
    setLoadedCustomer(customer);
    setCustomerName(customer.name || "");
    const defaultAddr = customer.addresses?.find((a: any) => a.isDefault);
    if (isDelivery && defaultAddr) {
      setDeliveryAddress(defaultAddr.street || "");
    }
    setShowSuggestions(false);
  };

  const getValidPhone = () => {
    const digits = (deliveryPhone || '').replace(/\D/g, '');
    if (digits.length < 8) return undefined;
    return deliveryPhone.trim();
  };

  const handleSubmit = async (action: "save_list" | "save_mp" | "charge_weigh") => {
    if (cart.length === 0 || !customerName.trim()) return;

    if (isDelivery && (!deliveryAddress.trim() || !deliveryPhone.trim())) {
      notifications.show({ title: "Datos de delivery obligatorios", message: "Completá dirección y teléfono para delivery", color: "red" });
      return;
    }

    try {
      const hasCartaItems = cart.some(item => item.quantity !== undefined);
      const hasKgItems = cart.some(item => item.weightKg !== undefined && item.weightKg > 0);
      
      // FIX: Enviar TODOS los items en un solo array unificado (sin fake 0.001)
      const allItems = cart
        .filter(i => (i.weightKg !== undefined && i.weightKg > 0) || (i.quantity !== undefined && i.quantity > 0))
        .map(i => ({
          productId: i.productId,
          weightKg: i.weightKg !== undefined ? i.weightKg : undefined,
          quantity: i.quantity !== undefined ? i.quantity : undefined,
          notes: itemNotes[i.productId || ''] || undefined
        }));
      
      // FIX: Si es "kilaje y cobrar", marcar isSentToKitchen=true desde la creación
      const shouldSendToKitchen = action === "charge_weigh";
      
      const res = await api.post("/api/orders", {
        shiftId,
        customerName: customerName.trim(),
        isDelivery,
        deliveryAddress: isDelivery ? deliveryAddress.trim() : undefined,
        deliveryPhone: isDelivery ? deliveryPhone.trim() : getValidPhone(),
        items: allItems,
        isSentToKitchen: shouldSendToKitchen,
      });

      let mode: "STATIONS_ONLY" | "KILAJE_AND_STATIONS" | "ALL_AND_STATIONS" | "ALL_ONLY" | "KILAJE_ONLY" | null = null;
      
      if (isDelivery) {
        // DELIVERY: Ticket completo con precios + comandas estaciones
        mode = hasCartaItems ? "ALL_AND_STATIONS" : "ALL_ONLY";
      } else {
        // RETIRO
        if (action === "save_list") {
          // CARGAR: Solo comandas COCINA/BARRA (NO imprime ENTREGA)
          mode = hasCartaItems ? "STATIONS_ONLY" : null;
        } else if (action === "save_mp") {
          // CARGAR Y COBRAR: Solo comandas COCINA/BARRA + drawer
          mode = hasCartaItems ? "STATIONS_ONLY" : null;
        } else if (action === "charge_weigh") {
          // KILAJE Y COBRAR: Comanda ENTREGA + COCINA/BARRA (SIN ticket con precios)
          mode = hasCartaItems ? "KILAJE_AND_STATIONS" : "KILAJE_ONLY";
        }
      }

      // Imprimir comandas si corresponde
      if (mode) triggerPrint(res.data, mode);

      // Refrescar lista de pedidos
      await fetchOrders();

      // Abrir drawer de cobro si corresponde
      if (action === "save_mp" || action === "charge_weigh") {
        // FIX: Usar datos frescos del backend (ya tiene isSentToKitchen correcto)
        setEditingOrder(res.data);
        openPaymentDrawer(res.data.id, Number(res.data.totalAmount || res.data.totalPrice || total));
      } else {
        // Cargar simple: limpiar formulario
        handleClearForm();
      }
    } catch (err) { 
      showApiError(err, "Error al crear pedido"); 
    }
  };

  const openPaymentDrawer = (orderId: string, amount: number, orderData?: any) => {
    setSelectedOrderId(orderId);
    setPaymentAmount(amount);
    setReceivedAmount(amount);
    setPendingOrderUpdate(orderData || null);
    
    setPaymentMethod(isDelivery ? "mercadopago" : "efectivo");
    setProcessingPayment(false);
    setPaymentDrawerOpen(true);
    setTimeout(() => receivedInputRef.current?.focus(), 100);
  };

  const handlePayment = async () => {
    if (!selectedOrderId) return;
    setProcessingPayment(true);
    
    try {
      const payload: any = {
        paymentMethod: paymentMethod === "mercadopago" ? "MERCADO PAGO" : paymentMethod.toUpperCase(),
        isPaid: true,
        ...pendingOrderUpdate,
      };
      
      // Si viene de "Kilaje y Cobrar", marcar como DELIVERED
      if (markAsDeliveredOnPay) {
        payload.status = "DELIVERED";
      }

      const res = await api.patch(`/api/orders/${selectedOrderId}/status`, payload);
      
      notifications.show({ 
        title: "¡Cobro Exitoso!", 
        message: markAsDeliveredOnPay ? `Pedido cobrado y entregado` : `Pedido cobrado correctamente`, 
        color: "green", 
        icon: <IconCheck size={16} /> 
      });
      
      setPaymentDrawerOpen(false);
      setMarkAsDeliveredOnPay(false);
      handleClearForm();
      fetchOrders(); 
    } catch (err) {
      showApiError(err, "Error al procesar el pago");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleOrderClick = (order: Order) => {
    // SEGURIDAD: Solo bloquear pedidos cancelados
    if (order.status === "CANCELLED") {
      notifications.show({
        title: "Pedido cancelado",
        message: "Este pedido fue cancelado y no se puede abrir",
        color: "red"
      });
      return;
    }
    
    // Pedidos cobrados se pueden abrir en modo solo lectura
    
    setEditingOrder(order);
    setCustomerName(order.customerName);
    setIsDelivery(order.isDelivery);
    setDeliveryAddress(order.deliveryAddress || "");
    setDeliveryPhone(order.deliveryPhone || "");
    
    // 7. FIX: Poblar el carrito respetando KG y Carta
    const cartItems: OrderItem[] = order.items.map(item => {
      const isKg = item.weightKg !== undefined && Number(item.weightKg) > 0;
      return {
        productId: item.product.id,
        productName: item.product.name,
        pricePerKg: isKg ? Number(item.product.pricePerKg || item.product.price) : undefined,
        weightKg: isKg ? Number(item.weightKg) : undefined,
        price: !isKg ? Number(item.product.price || item.product.pricePerKg) : undefined,
        quantity: !isKg ? Number(item.quantity) : undefined,
        notes: item.notes,
      };
    });
    setCart(cartItems);
    setOriginalOrderItems(cartItems);
    
    // Cargar notas de los items desde la DB
    const notesMap: Record<string, string> = {};
    order.items.forEach(item => {
      if (item.notes) {
        notesMap[item.product.id] = item.notes;
      }
    });
    setItemNotes(notesMap);
  };

  const handleSendToKitchen = async (reason?: string) => {
    if (!editingOrder) return;
    
    if (!editingOrder.isSentToKitchen && isDelivery && (!deliveryAddress.trim() || !deliveryPhone.trim())) {
      notifications.show({ title: "Datos faltantes", message: "Completá dirección y teléfono", color: "red" });
      return;
    }

    try {
      const currentNotes = editingOrder.notes || "";
      const reprintCount = (currentNotes.match(/\[RE-IMPRESIÓN/g) || []).length + 1;
      const auditNote = reason 
        ? `${currentNotes}\n[RE-IMPRESIÓN #${reprintCount} ${new Date().toLocaleTimeString()}] Motivo: ${reason}`
        : currentNotes;

      // RE-IMPRESIÓN: Solo actualizar notas (no tocar items)
      if (reason) {
        const res = await api.patch(`/api/orders/${editingOrder.id}`, {
          notes: auditNote,
          isSentToKitchen: true,
        });

        if (res.data) {
          // Inyectar printCount para que la comanda muestre DUPLICADO #N
          const printData = { ...res.data, reprintCount };
          triggerPrint(printData, "KILAJE_ONLY");
        }

        notifications.show({ 
          title: "RE-IMPRESIÓN EXITOSA", 
          message: `Duplicado #${reprintCount} registrado`, 
          color: "orange",
          icon: <IconPrinter size={16} />,
        });

        setEditingOrder(res.data);
        await fetchOrders();
        return;
      }

      // ENVÍO NORMAL A KILAJE (primera vez)
      const res = await api.patch(`/api/orders/${editingOrder.id}`, {
        customerName: customerName.trim(),
        isDelivery,
        deliveryAddress: isDelivery ? deliveryAddress.trim() : undefined,
        deliveryPhone: isDelivery ? deliveryPhone.trim() : getValidPhone(),
        items: cart
          .filter(i => (i.weightKg !== undefined && i.weightKg > 0) || (i.quantity !== undefined && i.quantity > 0))
          .map((item) => ({ 
            productId: item.productId, 
            weightKg: item.weightKg !== undefined ? item.weightKg : undefined, 
            quantity: item.quantity !== undefined ? item.quantity : undefined,
            notes: itemNotes[item.productId || ''] || undefined
          })),
        notes: auditNote,
        isSentToKitchen: true,
      });

      if (res.data) {
        let mode: "KILAJE_ONLY" | "KILAJE_AND_STATIONS" | "ALL_AND_STATIONS" | "ALL_ONLY";
        
        if (res.data.isDelivery) {
          const hasCartaItems = res.data.items.some((i: any) => i.unitType !== "KG");
          mode = hasCartaItems ? "ALL_AND_STATIONS" : "ALL_ONLY";
        } else {
          // RETIRO: Solo imprimir COCINA/BARRA si hay adición real
          mode = res.data.isAddition ? "KILAJE_AND_STATIONS" : "KILAJE_ONLY";
        }
        
        triggerPrint(res.data, mode);
        setEditingOrder(res.data);
      }

      notifications.show({ 
        title: "Comanda impresa", 
        message: "Pedido actualizado", 
        color: "blue",
        icon: <IconPrinter size={16} />,
      });

      await fetchOrders();
    } catch (err) {
      showApiError(err, "Error al procesar la comanda");
    }
  };

  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    
    if (!cancellationNote.trim()) {
      notifications.show({
        title: "Nota requerida",
        message: "Debe proporcionar una nota explicando el motivo de la cancelación",
        color: "red"
      });
      return;
    }

    // Si el pedido está pagado, exigir PIN de administrador
    if (orderToCancel.isPaid && !cancellationPin.trim()) {
      notifications.show({
        title: "PIN requerido",
        message: "Para cancelar un pedido cobrado necesitás el PIN de administrador",
        color: "red"
      });
      return;
    }
    
    try {
      await api.patch(`/api/orders/${orderToCancel.id}/status`, {
        status: "CANCELLED",
        isPaid: false,
        cancellationNote: cancellationNote.trim(),
        pin: cancellationPin.trim() || undefined,
      });
      notifications.show({ 
        title: "Pedido cancelado", 
        message: orderToCancel.isPaid 
          ? "El pedido fue cancelado y el cobro fue revertido" 
          : "El pedido fue cancelado correctamente", 
        color: "green" 
      });
      setCancelModalOpen(false);
      setOrderToCancel(null);
      setCancellationNote("");
      setCancellationPin("");
      fetchOrders();
      handleClearForm();
    } catch (err: any) {
      showApiError(err, "Error al cancelar pedido");
    }
  };

  const triggerPrint = (orderData: any, printMode: "STATIONS_ONLY" | "KILAJE_AND_STATIONS" | "ALL_AND_STATIONS" | "ALL_ONLY" | "KILAJE_ONLY" | "CUSTOMER" = "ALL_ONLY") => {
    console.log('🔍 DEBUG triggerPrint - orderData.items:', orderData.items);
    
    const printItems = orderData.items.map((item: any) => {
      const isKg = item.unitType === 'KG';
      console.log('🔍 DEBUG item:', {
        productName: item.product?.name,
        unitType: item.unitType,
        quantity: item.quantity,
        weightKg: item.weightKg,
        isKg,
        willUseWeightKg: isKg ? Number(item.quantity || 0) : undefined
      });
      
      return {
        productName: item.product?.name || "Producto",
        destination: item.destination,
        unitType: item.unitType,
        subtotal: Number(item.subtotal || 0),
        notes: item.notes || "",
        quantity: isKg ? undefined : Number(item.quantity || 1),
        unitPrice: isKg ? undefined : Number(item.unitPrice || 0),
        weightKg: isKg ? Number(item.weightKg || item.quantity || 0) : undefined,
        pricePerKg: isKg ? Number(item.unitPrice || 0) : undefined,
      };
    });
    
    console.log('🔍 DEBUG printItems mapeados:', printItems);

    // El backend ya calcula isAddition, addedItems y previousItems
    const isAddition = orderData.isAddition || false;
    const addedItems = orderData.addedItems || [];
    const previousItems = orderData.previousItems || [];

    setPrintData({
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName || "Cliente",
      isDelivery: !!orderData.isDelivery,
      deliveryAddress: orderData.deliveryAddress,
      deliveryPhone: orderData.deliveryPhone,
      items: printItems,
      total: Number(orderData.totalAmount || orderData.totalPrice || 0),
      createdAt: orderData.createdAt || new Date().toISOString(),
      printCount: orderData.reprintCount || orderData.notes?.match(/\[RE-IMPRESIÓN/g)?.length || 0,
      isAddition,
      addedItems,
      previousItems,
      printMode,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "orange";
      case "WEIGHED": return "blue";
      case "PAID": return "green";
      case "DELIVERED": return "gray";
      case "CANCELLED": return "red";
      default: return "gray";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return "Pendiente";
      case "WEIGHED": return "Pesado";
      case "PAID": return "Pagado";
      case "DELIVERED": return "Entregado";
      case "CANCELLED": return "Anulado";
      default: return status;
    }
  };

  // Filtrar por búsqueda
  const filteredOrders = orders.filter(order => 
    order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Orden: 1.Pendientes 2.Kilaje sin pagar 3.Deliveries 4.Kilaje pagado (abajo)
  const getOrderTier = (o: Order) => {
    if (o.status === "CANCELLED") return 99;
    if (!o.isSentToKitchen) return 0; // Pendiente
    if (!o.isPaid) return 1; // Kilaje sin pagar
    if (o.isDelivery) return 2; // Delivery (pagado)
    return 3; // Retiro kilaje pagado (abajo)
  };
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const ta = getOrderTier(a);
    const tb = getOrderTier(b);
    if (ta !== tb) return ta - tb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Bloquear edición solo si está cancelado (cobrado se puede ver)
  const isFormLocked = !!(editingOrder && editingOrder.status === "CANCELLED");
  const isKitchenLocked = !!(editingOrder && editingOrder.isSentToKitchen);
  // Bloquear inputs si está cobrado (pero se puede ver el pedido)
  const isInputLocked = !!(editingOrder && (editingOrder.isPaid || editingOrder.status === "CANCELLED"));

  return (
    <div className="gd-content">
      <Tabs value={activeTab} onChange={setActiveTab} variant="pills">
        <Tabs.List mb="md">
          {user?.role !== "ENCARGADO_DELIVERY" && (
            <Tabs.Tab value="lista_general" leftSection={<IconScale size={16} />}>
              Lista General
            </Tabs.Tab>
          )}
          <Tabs.Tab value="delivery" leftSection={<IconTruck size={16} />}>
            Delivery
          </Tabs.Tab>
          {user?.role !== "ENCARGADO_DELIVERY" && (
            <Tabs.Tab value="whatsapp" leftSection={<IconBrandWhatsapp size={16} />}>
              WhatsApp
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="lista_general">
          <div className={styles.splitLayout} style={!canLoadOrders ? { gridTemplateColumns: "1fr" } : undefined}>
            <div className={styles.ordersGrid}>
              <Group justify="space-between" mb="sm">
                <Text fw={700} size="sm" c="dimmed">LISTA GENERAL</Text>
                <TextInput
                  placeholder="Buscar por cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget?.value || "")}
                  size="xs"
                  style={{ width: 200 }}
                />
              </Group>
        {loadingOrders ? (
          <Center h={200}><Loader color="orange" size="sm" /></Center>
        ) : orders.length === 0 ? (
          <Text size="sm" c="dimmed">No hay pedidos en este turno.</Text>
        ) : (
          <div className={styles.gridTable}>
            <div className={styles.gridHeader}>
              <div>Cliente</div>
              <div>Tipo</div>
              <div>Pedido</div>
              <div>Total</div>
              <div>Estado</div>
              <div>Cargado por</div>
              <div>Acción</div>
            </div>
            {sortedOrders.map((order) => (
              <div
                key={order.id}
                className={styles.gridRow}
                onClick={() => handleOrderClick(order)}
                style={{
                  opacity: (order.isPaid && order.isSentToKitchen) || order.status === "CANCELLED" ? 0.6 : 1,
                  cursor: order.status === "CANCELLED" ? "not-allowed" : "pointer"
                }}
              >
                <div onClick={() => handleOrderClick(order)} style={{ cursor: "pointer" }}>{order.customerName}</div>
                <div onClick={() => handleOrderClick(order)} style={{ cursor: "pointer" }}>
                  <Badge size="xs" color={order.isDelivery ? "orange" : "blue"} variant="light">
                    {order.isDelivery ? "Delivery" : "Retiro"}
                  </Badge>
                </div>
                <div onClick={() => handleOrderClick(order)} style={{ cursor: "pointer" }}>
                  <Text size="xs" lineClamp={1}>
                    {order.items?.map(item => {
                       const qtyStr = item.weightKg ? `${item.weightKg}kg` : `x${item.quantity}`;
                       return `${item.product.name} (${qtyStr})`;
                    }).join(", ") || "-"}
                  </Text>
                </div>
                <div onClick={() => handleOrderClick(order)} style={{ cursor: "pointer" }}>
                  <Text fw={600}>{fmt(Number(order.totalAmount || order.totalPrice || 0))}</Text>
                </div>
                <div onClick={() => handleOrderClick(order)} style={{ cursor: "pointer" }}>
                  <Badge size="xs" color={getStatusColor(order.status)}>
                    {getStatusLabel(order.status)}
                  </Badge>
                </div>
                <div onClick={() => handleOrderClick(order)} style={{ cursor: "pointer" }}>
                  <Text size="xs" c="dimmed">{order.user?.name || "-"}</Text>
                </div>
                <div>
                  {!order.isPaid && order.status !== "CANCELLED" && canAssignAndCollect && (
                    <Button
                      size="xs"
                      color="green"
                      leftSection={<IconCash size={14} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSendToKitchenAfterPay(false);
                        openPaymentDrawer(order.id, Number(order.totalAmount || order.totalPrice));
                      }}
                    >
                      Cobrar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canLoadOrders && (
      <div className={styles.orderForm}>
        <Group justify="space-between" mb="sm">
          <Text fw={700} size="sm" c="dimmed">
            {editingOrder ? `EDITANDO PEDIDO #${editingOrder.orderNumber}` : "NUEVO PEDIDO"}
          </Text>
          {editingOrder && (
            <ActionIcon variant="subtle" color="gray" onClick={handleClearForm}>
              <IconX size={16} />
            </ActionIcon>
          )}
        </Group>

        {(editingOrder?.isPaid || isFormLocked) && (
          <Alert 
            icon={editingOrder?.isPaid ? <IconCheck size={16} /> : <IconPrinter size={16} />} 
            color={editingOrder?.isPaid ? "green" : "red"} 
            mb="md"
          >
            {editingOrder?.isPaid
              ? "Pedido cobrado - Solo lectura (puedes imprimir comandas)"
              : "Pedido cancelado - No se puede modificar"}
          </Alert>
        )}

        <Stack gap="md">
          <Group gap="md" justify="space-between">
            <Group gap="md">
              <Button
                variant={!isDelivery ? "filled" : "light"}
                color="orange"
                leftSection={<IconHome size={16} />}
                onClick={() => setIsDelivery(false)}
                disabled={!!editingOrder}
              >
                Retiro
              </Button>
              <Button
                variant={isDelivery ? "filled" : "light"}
                color="blue"
                leftSection={<IconTruck size={16} />}
                onClick={() => {
                  setIsDelivery(true);
                  if (loadedCustomer && !deliveryAddress) {
                    const defaultAddr = loadedCustomer.addresses?.find((a: any) => a.isDefault);
                    if (defaultAddr) setDeliveryAddress(defaultAddr.street || "");
                  }
                }}
                disabled={!!editingOrder}
              >
                Delivery
              </Button>
            </Group>
            {editingOrder && (
              <ActionIcon
                variant="light"
                color="blue"
                size="lg"
                onClick={() => triggerPrint(editingOrder, "CUSTOMER")}
              >
                <IconPrinter size={20} />
              </ActionIcon>
            )}
          </Group>

          {/* TELÉFONO con búsqueda progresiva */}
          <div style={{ position: "relative" }}>
            <TextInput
              placeholder={isDelivery ? "Teléfono — 379..." : "Teléfono (opcional) — 379..."}
              value={deliveryPhone}
              onChange={(e) => handlePhoneChange(e.currentTarget.value)}
              onFocus={() => {
                if (!deliveryPhone && !isInputLocked) {
                  setDeliveryPhone("379");
                  handlePhoneChange("379");
                }
                if (customerSuggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              required={isDelivery}
              disabled={isInputLocked}
            />
            {showSuggestions && customerSuggestions.length > 0 && (
              <Paper
                shadow="md"
                withBorder
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {customerSuggestions.map((c) => {
                  const defaultAddr = c.addresses?.find((a: any) => a.isDefault);
                  return (
                    <div
                      key={c.id}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid var(--mantine-color-gray-2)",
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDeliveryPhone(c.phone);
                        handleSelectCustomer(c);
                      }}
                    >
                      <Text size="sm" fw={600}>{c.name || "Sin nombre"}</Text>
                      <Text size="xs" c="dimmed">{c.phone}{defaultAddr ? ` · ${defaultAddr.street}` : ""}</Text>
                    </div>
                  );
                })}
              </Paper>
            )}
          </div>

          <TextInput
            placeholder="Nombre del cliente"
            value={customerName}
            onChange={(e) => setCustomerName(e.currentTarget.value)}
            required
            disabled={isInputLocked}
          />

          {isDelivery && (
            <TextInput
              placeholder="Dirección de entrega"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.currentTarget.value)}
              required
              disabled={isInputLocked}
            />
          )}

          {/* CustomerCard con datos de fidelización */}
          {loadedCustomer && (
            <CustomerCard
              customer={loadedCustomer}
              isDelivery={isDelivery}
              onAutoFill={(data) => {
                if (data.name) setCustomerName(data.name);
                if (data.address && isDelivery) setDeliveryAddress(data.address);
              }}
            />
          )}

          <Divider label="Productos" labelPosition="center" />

          <Button
            variant="light"
            color="blue"
            size="sm"
            fullWidth
            onClick={() => setCartaDrawerOpen(true)}
            disabled={isInputLocked}
          >
            + Agregar de Carta
          </Button>

          {loadingProducts ? (
            <Center h={100}><Loader color="orange" size="sm" /></Center>
          ) : (
            <Stack gap="xs">
              {products.map((product) => {
                const inCart = cart.find((i) => i.productId === product.id);
                return (
                  <Group key={product.id} justify="space-between" className={styles.productRow}>
                    <div style={{ flex: 1 }}>
                      <Text fw={600} size="sm">{product.name}</Text>
                      <Text size="xs" c="dimmed">{fmt(Number(product.pricePerKg))} / kg</Text>
                      {itemNotes[product.id] && (
                        <Text size="xs" c="blue" fs="italic">📝 {itemNotes[product.id]}</Text>
                      )}
                    </div>
                    <Group gap={4}>
                      <Popover width={250} position="bottom" withArrow shadow="md">
                        <Popover.Target>
                          <ActionIcon
                            size="sm"
                            variant={itemNotes[product.id] ? "filled" : "light"}
                            color="blue"
                            disabled={isInputLocked}
                          >
                            <IconPencil size={12} />
                          </ActionIcon>
                        </Popover.Target>
                        <Popover.Dropdown>
                          <Stack gap="xs">
                            <Text size="xs" fw={600}>Aclaraciones</Text>
                            <Textarea
                              placeholder="Ej: 2 presas x kg"
                              value={itemNotes[product.id] || ""}
                              onChange={(e) => setItemNotes(prev => ({ ...prev, [product.id]: e.currentTarget?.value || "" }))}
                              size="xs"
                              rows={2}
                              autosize
                            />
                          </Stack>
                        </Popover.Dropdown>
                      </Popover>
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="red"
                        onClick={() => updateWeight(product.id, -0.5)}
                        disabled={!inCart || isInputLocked}
                      >
                        <IconMinus size={12} />
                      </ActionIcon>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={inCart?.weightKg || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setWeight(product.id, val);
                        }}
                        className={styles.weightInput}
                        disabled={isFormLocked}
                      />
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="green"
                        onClick={() => updateWeight(product.id, 0.5)}
                        disabled={isInputLocked}
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                    </Group>
                  </Group>
                );
              })}
            </Stack>
          )}

          {/* Items de Carta */}
          {cart.filter(item => item.quantity !== undefined).length > 0 && (
            <Stack gap="xs" mt="md">
              <Text size="sm" c="dimmed" fw={600}>ITEMS DE CARTA</Text>
              {cart.filter(item => item.quantity !== undefined).map((item, idx) => (
                <Group key={`carta-${idx}`} justify="space-between" className={styles.productRow}>
                  <div style={{ flex: 1 }}>
                    <Text fw={600} size="sm">{item.productName}</Text>
                    <Text size="xs" c="dimmed">{fmt(item.price || 0)} c/u</Text>
                    {itemNotes[item.productId || `carta-${idx}`] && (
                      <Text size="xs" c="blue" fs="italic">📝 {itemNotes[item.productId || `carta-${idx}`]}</Text>
                    )}
                  </div>
                  <Group gap={4}>
                    <Popover width={250} position="bottom" withArrow shadow="md">
                      <Popover.Target>
                        <ActionIcon
                          size="sm"
                          variant={itemNotes[item.productId || `carta-${idx}`] ? "filled" : "light"}
                          color="blue"
                          disabled={isInputLocked}
                        >
                          <IconPencil size={12} />
                        </ActionIcon>
                      </Popover.Target>
                      <Popover.Dropdown>
                        <Stack gap="xs">
                          <Text size="xs" fw={600}>Aclaraciones</Text>
                          <Textarea
                            placeholder="Ej: sin cebolla"
                            value={itemNotes[item.productId || `carta-${idx}`] || ""}
                            onChange={(e) => setItemNotes(prev => ({ ...prev, [item.productId || `carta-${idx}`]: e.currentTarget?.value || "" }))}
                            size="xs"
                            rows={2}
                            autosize
                          />
                        </Stack>
                      </Popover.Dropdown>
                    </Popover>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="red"
                      onClick={() => {
                        setCart(prev => {
                          const idx = prev.indexOf(item);
                          if (idx === -1) return prev;
                          const current = prev[idx];
                          if (current.quantity && current.quantity > 1) {
                            return prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity! - 1 } : it);
                          }
                          return prev.filter((_, i) => i !== idx);
                        });
                      }}
                      disabled={isInputLocked}
                    >
                      <IconMinus size={12} />
                    </ActionIcon>
                    <Text fw={700} size="sm" style={{ minWidth: "30px", textAlign: "center" }}>
                      {item.quantity || 0}
                    </Text>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="green"
                      onClick={() => {
                        setCart(prev => prev.map((it, i) => 
                          i === prev.indexOf(item) && it.quantity 
                            ? { ...it, quantity: it.quantity + 1 } 
                            : it
                        ));
                      }}
                      disabled={isInputLocked}
                    >
                      <IconPlus size={12} />
                    </ActionIcon>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="red"
                      onClick={() => {
                        setCart(prev => prev.filter(i => i !== item));
                      }}
                      disabled={isInputLocked}
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                </Group>
              ))}
            </Stack>
          )}

          <Divider />

          <Group justify="space-between">
            <Text fw={700} size="lg">TOTAL</Text>
            <Text fw={800} size="xl" c="orange">{fmt(total)}</Text>
          </Group>

          {/* PANEL DE ACCIONES */}
          {(() => {
            if (!editingOrder) {
              return (
            <Stack gap="xs">
              <Button color="orange" fullWidth onClick={() => handleSubmit("save_list")} disabled={cart.length === 0 || !customerName.trim()}>
                Cargar
              </Button>
              <Button color="blue" fullWidth onClick={() => handleSubmit("save_mp")} disabled={cart.length === 0 || !customerName.trim()}>
                Cargar y cobrar
              </Button>
              {!isDelivery && (
                <Button color="orange" variant="outline" fullWidth onClick={() => handleSubmit("charge_weigh")} disabled={cart.length === 0 || !customerName.trim()}>
                  Kilaje y cobrar
                </Button>
              )}
            </Stack>
              );
            }
            
            // EDICIÓN: Detectar si hay cambios (adiciones) comparando cart con items guardados en DB
            const hasChanges = editingOrder.isSentToKitchen && (() => {
              const currentMap = new Map(cart.map(item => [
                item.productId, 
                Number(item.weightKg || item.quantity || 0)
              ]));
              
              const savedMap = new Map(editingOrder.items.map((item: any) => [
                item.productId,
                Number(item.weightKg || item.quantity || 0)
              ]));
              
              if (currentMap.size !== savedMap.size) return true;
              
              for (const [productId, currentQty] of currentMap) {
                const savedQty = savedMap.get(productId);
                if (savedQty === undefined || currentQty !== savedQty) return true;
              }
              
              return false;
            })();

            // Helper: enviar a kilaje (PATCH) y abrir drawer de cobro
            const handleKilajeYCobrar = async () => {
              try {
                // FIX: Enviar TODOS los items en un solo array unificado
                const allItems = cart
                  .filter(i => (i.weightKg !== undefined && i.weightKg > 0) || (i.quantity !== undefined && i.quantity > 0))
                  .map(i => ({
                    productId: i.productId,
                    weightKg: i.weightKg !== undefined ? i.weightKg : undefined,
                    quantity: i.quantity !== undefined ? i.quantity : undefined,
                    notes: itemNotes[i.productId || ''] || undefined
                  }));
                
                const res = await api.patch(`/api/orders/${editingOrder!.id}`, {
                  customerName: customerName.trim(),
                  isDelivery,
                  deliveryAddress: isDelivery ? deliveryAddress.trim() : undefined,
        deliveryPhone: isDelivery ? deliveryPhone.trim() : getValidPhone(),
        items: allItems,
        isSentToKitchen: true,
                });
                
                if (res.data) {
                  const hasNewCartaItems = res.data.isAddition && (res.data.items || []).some((i: any) => i.unitType !== "KG");
                  if (hasNewCartaItems) {
                    triggerPrint(res.data, "KILAJE_AND_STATIONS");
                  } else {
                    triggerPrint(res.data, "KILAJE_ONLY");
                  }
                  
                  // FIX: Usar res.data directamente (ya tiene isSentToKitchen=true)
                  setEditingOrder(res.data);
                  await fetchOrders();
                  openPaymentDrawer(res.data.id, Number(res.data.totalAmount || res.data.totalPrice || total));
                }
              } catch (err) {
                showApiError(err, "Error al enviar a kilaje");
              }
            };
            
            return (
            <Stack gap="xs">
              {/* PEDIDO NO PAGADO */}
              {!editingOrder.isPaid && editingOrder.status !== "CANCELLED" && (
                <>
                  {/* Botón GUARDAR - Guarda cambios + imprime comandas cocina de items nuevos */}
                  <Button
                    color="orange"
                    fullWidth
                    onClick={async () => {
                      try {
                        const allItems = cart
                          .filter(i => (i.weightKg !== undefined && i.weightKg > 0) || (i.quantity !== undefined && i.quantity > 0))
                          .map(i => ({
                            productId: i.productId,
                            weightKg: i.weightKg !== undefined ? i.weightKg : undefined,
                            quantity: i.quantity !== undefined ? i.quantity : undefined,
                            notes: itemNotes[i.productId || ''] || undefined
                          }));

                        const res = await api.patch(`/api/orders/${editingOrder!.id}`, {
                          customerName: customerName.trim(),
                          isDelivery,
                          deliveryAddress: isDelivery ? deliveryAddress.trim() : undefined,
                          deliveryPhone: isDelivery ? deliveryPhone.trim() : getValidPhone(),
                          items: allItems,
                        });

                        if (res.data) {
                          if (res.data.isAddition) {
                            const hasNewCarta = (res.data.addedItems || []).some((i: any) => i.unitType !== "KG");
                            if (hasNewCarta) triggerPrint(res.data, "STATIONS_ONLY");
                          }
                          setEditingOrder(res.data);
                          await fetchOrders();
                          notifications.show({ title: "Guardado", message: "Pedido actualizado", color: "green" });
                        }
                      } catch (err) {
                        showApiError(err, "Error al guardar");
                      }
                    }}
                  >
                    Guardar cambios
                  </Button>

                  {/* Botón COBRAR - Guarda + imprime comandas nuevas + abre drawer */}
                  <Button
                    color="green"
                    fullWidth
                    leftSection={<IconCash size={16} />}
                    onClick={async () => {
                      try {
                        const allItems = cart
                          .filter(i => (i.weightKg !== undefined && i.weightKg > 0) || (i.quantity !== undefined && i.quantity > 0))
                          .map(i => ({
                            productId: i.productId,
                            weightKg: i.weightKg !== undefined ? i.weightKg : undefined,
                            quantity: i.quantity !== undefined ? i.quantity : undefined,
                            notes: itemNotes[i.productId || ''] || undefined
                          }));

                        const res = await api.patch(`/api/orders/${editingOrder!.id}`, {
                          customerName: customerName.trim(),
                          isDelivery,
                          deliveryAddress: isDelivery ? deliveryAddress.trim() : undefined,
                          deliveryPhone: isDelivery ? deliveryPhone.trim() : getValidPhone(),
                          items: allItems,
                        });

                        if (res.data) {
                          if (res.data.isAddition) {
                            const hasNewCarta = (res.data.addedItems || []).some((i: any) => i.unitType !== "KG");
                            if (hasNewCarta) triggerPrint(res.data, "STATIONS_ONLY");
                          }
                          setEditingOrder(res.data);
                          await fetchOrders();
                          openPaymentDrawer(res.data.id, Number(res.data.totalAmount || res.data.totalPrice || total));
                        }
                      } catch (err) {
                        showApiError(err, "Error al guardar y cobrar");
                      }
                    }}
                  >
                    Cobrar
                  </Button>
                  
                  {/* RETIRO: Botón KILAJE Y COBRAR (solo si NO se envió a kilaje aún) */}
                  {!isDelivery && !editingOrder.isSentToKitchen && (
                    <Button
                      color="orange"
                      variant="outline"
                      fullWidth
                      leftSection={<IconPrinter size={16} />}
                      onClick={handleKilajeYCobrar}
                    >
                      Kilaje y cobrar
                    </Button>
                  )}
                  
                  {/* RETIRO: Botón RE-IMPRIMIR (ya en kilaje, SIN cambios) → abre modal seguridad */}
                  {!isDelivery && editingOrder.isSentToKitchen && !hasChanges && (
                    <Button
                      color="gray"
                      variant="outline"
                      fullWidth
                      leftSection={<IconPrinter size={16} />}
                      onClick={() => setReprintModalOpen(true)}
                    >
                      Re-imprimir Comanda
                    </Button>
                  )}
                  
                  {/* RETIRO: Botón ADICIÓN Y COBRAR (ya en kilaje, CON cambios) */}
                  {!isDelivery && editingOrder.isSentToKitchen && hasChanges && (
                    <Button
                      color="orange"
                      variant="outline"
                      fullWidth
                      leftSection={<IconPrinter size={16} />}
                      onClick={handleKilajeYCobrar}
                    >
                      Adición y cobrar
                    </Button>
                  )}
                </>
              )}
              
              {/* PEDIDO PAGADO PERO NO ENVIADO A KILAJE */}
              {editingOrder!.isPaid && !editingOrder!.isSentToKitchen && (
                <Button
                  color="orange"
                  fullWidth
                  leftSection={<IconPrinter size={16} />}
                  onClick={async () => {
                    try {
                      const res = await api.patch(`/api/orders/${editingOrder!.id}`, {
                        isSentToKitchen: true,
                      });
                      
                      if (res.data) {
                        triggerPrint(res.data, "KILAJE_ONLY");
                        setEditingOrder(res.data);
                      }
                      
                      notifications.show({
                        title: "Comanda impresa",
                        message: "Pedido enviado a entrega",
                        color: "green",
                      });
                      
                      await fetchOrders();
                    } catch (err) {
                      showApiError(err, "Error al imprimir comanda");
                    }
                  }}
                >
                  Imprimir Comanda
                </Button>
              )}
              
              {/* PEDIDO PAGADO Y ENVIADO A KILAJE → solo reimprimir con seguridad */}
              {editingOrder!.isPaid && editingOrder!.isSentToKitchen && (
                <Button
                  color="gray"
                  variant="outline"
                  fullWidth
                  leftSection={<IconPrinter size={16} />}
                  onClick={() => setReprintModalOpen(true)}
                >
                  Re-imprimir Comanda
                </Button>
              )}
              
              {/* CANCELAR PEDIDO - Siempre visible para pedidos cargados (todos los estados) */}
              {editingOrder.status !== "CANCELLED" && (
                <Button 
                  color="red" 
                  variant="light"
                  fullWidth 
                  leftSection={<IconTrash size={16} />} 
                  onClick={() => {
                    setOrderToCancel(editingOrder);
                    setCancelModalOpen(true);
                  }}
                >
                  Cancelar Pedido
                </Button>
              )}
            </Stack>
          );
          })()}
        </Stack>
      </div>
      )}

      <Drawer
        opened={paymentDrawerOpen}
        onClose={() => !processingPayment && setPaymentDrawerOpen(false)}
        title="Centro de Cobro"
        size="md"
      >
        <Stack gap="lg">
          <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#f0fdf4", borderColor: "#86efac" }}>
            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed" fw={500}>TOTAL A COBRAR</Text>
              <Text size="32px" fw={800} c="#16a34a">{fmt(paymentAmount)}</Text>
            </Group>
          </Paper>

          <Stack gap="xs">
            <Text size="sm" fw={600} c="dimmed">MEDIO DE PAGO</Text>
            <SegmentedControl
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as typeof paymentMethod)}
              disabled={processingPayment}
              fullWidth
              size="md"
              data={[
                {
                  value: "efectivo",
                  label: (
                    <Center style={{ gap: 8 }}>
                      <IconCash size={18} />
                      <span>Efectivo</span>
                    </Center>
                  ),
                },
                {
                  value: "mercadopago",
                  label: (
                    <Center style={{ gap: 8 }}>
                      <IconQrcode size={18} />
                      <span>Mercado Pago</span>
                    </Center>
                  ),
                },
                {
                  value: "tarjeta",
                  label: (
                    <Center style={{ gap: 8 }}>
                      <IconCreditCard size={18} />
                      <span>Débito/Crédito</span>
                    </Center>
                  ),
                },
              ]}
            />
          </Stack>

          {paymentMethod === "efectivo" && (
            <Stack gap="md">
              <NumberInput
                ref={receivedInputRef}
                label="MONTO RECIBIDO ($)"
                value={receivedAmount}
                onChange={(val) => setReceivedAmount(typeof val === "string" ? parseFloat(val) || 0 : val)}
                min={0}
                decimalScale={2}
                prefix="$"
                size="lg"
                disabled={processingPayment}
                styles={{
                  input: { fontSize: "20px", fontWeight: 600 },
                }}
              />
              
              {receivedAmount > 0 && (
                <Paper p="md" radius="md" withBorder style={{ 
                  backgroundColor: receivedAmount >= paymentAmount ? "#f0fdf4" : "#fef2f2",
                  borderColor: receivedAmount >= paymentAmount ? "#86efac" : "#fca5a5"
                }}>
                  <Group justify="space-between" align="center">
                    <Text size="sm" fw={600} c="dimmed">VUELTO</Text>
                    <Text size="24px" fw={700} c={receivedAmount >= paymentAmount ? "#16a34a" : "#dc2626"}>
                      {fmt(Math.max(0, receivedAmount - paymentAmount))}
                    </Text>
                  </Group>
                </Paper>
              )}
            </Stack>
          )}

          {paymentMethod === "mercadopago" && (
            <Paper p="md" radius="md" withBorder style={{ backgroundColor: "#eff6ff", borderColor: "#93c5fd" }}>
              <Stack gap="xs" align="center">
                <IconQrcode size={48} color="#3b82f6" />
                <Text size="sm" fw={600} ta="center">Esperando confirmación de pago...</Text>
                <Text size="xs" c="dimmed" ta="center">El cliente debe escanear el código QR</Text>
              </Stack>
            </Paper>
          )}

          <Group justify="space-between" mt="md">
            <Button 
              variant="subtle" 
              color="gray" 
              onClick={() => setPaymentDrawerOpen(false)}
              disabled={processingPayment}
            >
              Cancelar
            </Button>
            <Button 
              color="green" 
              size="lg"
              leftSection={processingPayment ? <Loader size={16} color="white" /> : <IconCheck size={20} />}
              onClick={handlePayment}
              disabled={
                processingPayment || 
                (paymentMethod === "efectivo" && receivedAmount < paymentAmount)
              }
              loading={processingPayment}
            >
              {processingPayment 
                ? (paymentMethod === "mercadopago" ? "Esperando pago..." : "Procesando...") 
                : "Confirmar Pago"}
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <Modal
        opened={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setCancellationNote("");
          setCancellationPin("");
        }}
        title={
          <Group gap="sm">
            <IconAlertTriangle size={20} color="#f97316" />
            <Text fw={700}>Cancelar Pedido</Text>
          </Group>
        }
        radius="lg"
        centered
        size="md"
      >
        <Stack gap="md">
          <Alert color={orderToCancel?.isPaid ? "red" : "orange"} icon={<IconAlertTriangle size={16} />}>
            <Text size="sm" fw={600}>
              Pedido #{orderToCancel?.orderNumber} - {orderToCancel?.customerName}
            </Text>
            <Text size="xs" c="dimmed">
              {orderToCancel?.isPaid 
                ? "Este pedido está COBRADO. La cancelación revertirá el pago." 
                : "Esta acción no se puede deshacer"}
            </Text>
          </Alert>
          
          <Textarea
            label="Motivo de cancelación"
            placeholder="Explica por qué se cancela este pedido..."
            required
            value={cancellationNote}
            onChange={(e) => setCancellationNote(e.currentTarget.value)}
            minRows={3}
            maxRows={5}
          />
          
          {orderToCancel?.isPaid && (
            <TextInput
              label="PIN de administrador"
              placeholder="Ingresa el PIN de administrador"
              type="password"
              required
              value={cancellationPin}
              onChange={(e) => setCancellationPin(e.currentTarget.value)}
              description="Requerido para cancelar pedidos cobrados"
            />
          )}
          
          <Group justify="flex-end">
            <Button 
              variant="subtle" 
              color="gray" 
              onClick={() => {
                setCancelModalOpen(false);
                setCancellationNote("");
                setCancellationPin("");
              }}
            >
              Cancelar
            </Button>
            <Button 
              color="red" 
              leftSection={<IconTrash size={16} />} 
              onClick={handleCancelOrder}
              disabled={!cancellationNote.trim() || (orderToCancel?.isPaid && !cancellationPin.trim())}
            >
              Confirmar Cancelación
            </Button>
          </Group>
        </Stack>
      </Modal>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="delivery">
          <DeliveryCommandCenter 
            shiftId={shiftId} 
            orders={orders as any} 
            onRefresh={fetchOrders}
            canAssignAndCollect={canAssignAndCollect}
          />
        </Tabs.Panel>

        <Tabs.Panel value="whatsapp">
          <WhatsAppCommandCenter shiftId={shiftId} />
        </Tabs.Panel>
      </Tabs>
      <Modal 
  opened={reprintModalOpen} 
  onClose={() => {
    setReprintModalOpen(false);
    setReprintReason("");
  }} 
  title="⚠️ SEGURIDAD: SEGUNDA IMPRESIÓN"
  centered
>
  <Stack>
    <Text size="sm" c="dimmed">
      Este pedido ya fue enviado a cocina. Para re-imprimir, debés justificar la acción. Esto quedará registrado para el dueño.
    </Text>
    <Textarea
      label="Motivo de la re-impresión"
      placeholder="Ej: El ticket salió borroso / El cliente cambió de opinión"
      required
      value={reprintReason}
  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReprintReason(e.currentTarget.value)}
/>
    <Button 
      color="red" 
      disabled={!reprintReason.trim()} 
      onClick={() => {
        handleSendToKitchen(reprintReason); 
        setReprintModalOpen(false);
        setReprintReason("");
      }}
    >
      Confirmar y Re-imprimir
    </Button>
  </Stack>
</Modal>

      {printData && (
        <ThermalPrint
          {...printData}
          onPrintComplete={() => setPrintData(null)}
        />
      )}

      <CartaSelector
        opened={cartaDrawerOpen}
        onClose={() => setCartaDrawerOpen(false)}
        onAddItems={handleAddCartaItems}
      />
    </div>
  );
}