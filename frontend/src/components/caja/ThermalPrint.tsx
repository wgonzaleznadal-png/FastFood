"use client";

import { useEffect } from "react";
import { ThermalPrinter } from "@/lib/thermalPrinter";
import { notifications } from "@mantine/notifications";

export default function ThermalPrint(props: any) {
  const { items, printMode = "ALL_ONLY", onPrintComplete, isAddition, addedItems, previousItems } = props;

  useEffect(() => {
    if (!props.orderNumber || !items || items.length === 0) return;

    const printTickets = async () => {
      try {
        const ticketsQueue: { type: string; items: any[]; isSimple: boolean }[] = [];

        // 1. EL FILTRO INTELIGENTE
        // A las estaciones (Cocina/Barra) SOLO les mandamos lo nuevo si es una adición.
        const itemsParaEstaciones = isAddition ? (addedItems || []) : items;

        const cocinaItems = itemsParaEstaciones.filter((i: any) => i.destination === "COCINA" && i.unitType !== "KG");
        const barraItems = itemsParaEstaciones.filter((i: any) => i.destination === "BARRA" && i.unitType !== "KG");
        
        // Kilaje/Entrega usa todo porque necesita ver la foto completa para armar la bolsa
        const entregaItems = items; 

        // 2. COMANDAS PARA ESTACIONES (COCINA/BARRA)
        // Se imprimen en: STATIONS_ONLY, KILAJE_AND_STATIONS, ALL_AND_STATIONS
        if (printMode === "STATIONS_ONLY" || printMode === "KILAJE_AND_STATIONS" || printMode === "ALL_AND_STATIONS") {
          if (cocinaItems.length > 0) ticketsQueue.push({ type: "COCINA", items: cocinaItems, isSimple: true });
          if (barraItems.length > 0) ticketsQueue.push({ type: "BARRA", items: barraItems, isSimple: true });
        }
        
        // 3. COMANDA DE KILAJE/ENTREGA (solo para RETIRO — armar la bolsa)
        // En DELIVERY no se imprime porque el cadete usa el ticket completo
        if (printMode === "KILAJE_ONLY" || printMode === "KILAJE_AND_STATIONS") {
          if (!isAddition || (isAddition && addedItems && addedItems.length > 0)) {
            ticketsQueue.push({ type: "ENTREGA", items: entregaItems, isSimple: true });
          }
        }

        // 4. TICKET COMPLETO CON PRECIOS (solo para DELIVERY y CUSTOMER)
        // NUNCA se imprime en retiro kilaje/adición — para eso está "Ticket Cliente"
        if (printMode === "ALL_ONLY" || printMode === "ALL_AND_STATIONS" || printMode === "CUSTOMER") {
          ticketsQueue.push({ 
            type: printMode === "CUSTOMER" ? "CLIENTE" : "ORIGINAL", 
            items, 
            isSimple: false 
          });
        }

        // 5. ENVÍO A LA IMPRESORA
        for (const ticket of ticketsQueue) {
          const tipoPedido = props.isDelivery ? 'DELIVERY' : 'RETIRO';
          
          const payload: any = {
            orderNumber: props.orderNumber,
            customerName: props.customerName,
            createdAt: props.createdAt,
            printCount: props.printCount || 0,
            isCustomerTicket: ticket.type === "CLIENTE",
          };

          if (ticket.isSimple) {
            // LÓGICA DE ESTACIONES Y ARMADO
            if (ticket.type === "ENTREGA" && isAddition) {
              // SOLO Entrega se entera de la Adición y recibe el Híbrido
              payload.headerTitle = `ADICION [ENTREGA]\n${tipoPedido}`;
              payload.isAddition = true;
              payload.addedItems = addedItems || [];
              payload.previousItems = previousItems || [];
            } else {
              // Cocina/Barra o un pedido nuevo normal
              payload.headerTitle = `COMANDA [${ticket.type}]\n${tipoPedido}`;
              payload.items = ticket.items; 
            }
          } else {
            // TICKET LIMPIO CON PRECIOS (Delivery, Cliente)
            payload.isDelivery = props.isDelivery;
            payload.deliveryAddress = props.deliveryAddress;
            payload.deliveryPhone = props.deliveryPhone;
            payload.paymentMethod = props.paymentMethod;
            payload.isPaid = props.isPaid;
            payload.items = ticket.items; 
            payload.total = props.total;
          }

          await ThermalPrinter.quickPrint(payload);
          await new Promise(r => setTimeout(r, 1000)); // Pausa entre tickets
        }

        notifications.show({ title: "Impresión exitosa", message: `${ticketsQueue.length} ticket(s) enviado(s)`, color: "green" });
      } catch (error: any) {
        notifications.show({ title: "Error Impresora", message: error.message || "Error desconocido", color: "red" });
      } finally {
        if (onPrintComplete) onPrintComplete();
      }
    };

    printTickets();
  }, [props.orderNumber, props.customerName, props.printMode, items]);

  return null;
}