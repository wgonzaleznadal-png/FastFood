import { Router } from 'express';
import { authenticate } from '../../middleware/tenantGuard';
import { ordersService } from './orders.service';
import {
  assignCadeteSchema,
  updateStatusSchema,
  updateCoordsSchema,
} from './orders.schema';

const router = Router();

// ─── ORDERS ROUTES (UNIFICADO E HÍBRIDO) ─────────────────────────────────

/**
 * GET /api/orders
 * Listar órdenes con filtros opcionales
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const { shiftId, status, isDelivery, source, customerId } = req.query;

    const filters: any = {};
    if (shiftId) filters.shiftId = String(shiftId);
    if (status) filters.status = String(status);
    if (isDelivery !== undefined) filters.isDelivery = isDelivery === 'true';
    if (source) filters.source = String(source);
    if (customerId) filters.customerId = String(customerId);

    const orders = await ordersService.listOrders(tenantId, filters);
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/:id
 * Obtener orden por ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = String(req.params.id);

    const order = await ordersService.getOrderById(tenantId, orderId);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orders
 * Crear nueva orden (HÍBRIDO)
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    
    // FIX HÍBRIDO: Pasamos req.body directo al service. 
    // Si usamos el schema.parse() estricto, nos borra los campos legacy 
    // como 'weightKg' o 'cartaItems' antes de que el Service los pueda traducir.
    const order = await ordersService.createOrder(tenantId, req.body);
    
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/orders/:id
 * Actualizar orden (HÍBRIDO)
 */
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = String(req.params.id);
    
    console.log('🔥 PATCH /api/orders/:id - orderId:', orderId);
    console.log('🔥 PATCH /api/orders/:id - req.body:', JSON.stringify(req.body, null, 2));
    console.log('🔥 PATCH /api/orders/:id - isSentToKitchen:', req.body.isSentToKitchen);
    
    // FIX HÍBRIDO: Igual que en el POST, mandamos el payload crudo al Service
    // para que la lógica híbrida haga su magia sin perder datos en el camino.
    const order = await ordersService.updateOrder(tenantId, orderId, req.body);
    
    console.log('🔥 PATCH /api/orders/:id - order.isSentToKitchen después de update:', order.isSentToKitchen);
    
    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/orders/:id
 * Eliminar orden
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = String(req.params.id);

    const result = await ordersService.deleteOrder(tenantId, orderId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orders/:id/kitchen
 * Marcar orden como enviada a cocina
 */
router.post('/:id/kitchen', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = String(req.params.id);

    const order = await ordersService.sendToKitchen(tenantId, orderId);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/orders/:id/status
 * Actualizar estado de orden (con soporte para cobro)
 */
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = String(req.params.id);
    const { status, paymentMethod, isPaid, ...orderData } = req.body;

    const order = await ordersService.updateStatus(
      tenantId, 
      orderId, 
      status || undefined, 
      paymentMethod,
      { ...orderData, isPaid }
    );
    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/orders/:id/cadete
 * Asignar cadete a orden
 */
router.patch('/:id/cadete', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = String(req.params.id);
    const { cadeteId } = assignCadeteSchema.parse(req.body);

    const order = await ordersService.assignCadete(tenantId, orderId, cadeteId);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/orders/:id/coords
 * Actualizar coordenadas de entrega
 */
router.patch('/:id/coords', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = String(req.params.id);
    const { deliveryLat, deliveryLng } = updateCoordsSchema.parse(req.body);

    const order = await ordersService.updateCoords(tenantId, orderId, deliveryLat, deliveryLng);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/shift/:shiftId/next-number
 * Obtener siguiente número de orden para un shift
 */
router.get('/shift/:shiftId/next-number', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const shiftId = String(req.params.shiftId);

    const nextNumber = await ordersService.getNextOrderNumber(tenantId, shiftId);
    res.json({ nextNumber });
  } catch (error) {
    next(error);
  }
});

router.get('/kitchen/stats', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    
    // Ejecutamos ambas consultas en paralelo para ser más rápidos
    const [stats, kilos] = await Promise.all([
      ordersService.getKitchenStats(tenantId),
      ordersService.getKitchenProductKilos(tenantId)
    ]);

    res.json({ stats, productKilos: kilos });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/kitchen/list
 * Obtener lista de pedidos activos para una estación (COCINA o BARRA)
 */
router.get('/kitchen/list', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const station = String(req.query.station || 'COCINA');

    const orders = await ordersService.getKitchenOrders(tenantId, station);
    res.json(orders);
  } catch (error) {
    next(error);
  }
});
export default router;