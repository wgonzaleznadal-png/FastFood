import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/tenantGuard';
import { requireModule } from '../../middleware/moduleGuard';
import { ordersService } from './orders.service';
import {
  assignCadeteSchema,
  updateStatusSchema,
  updateCoordsSchema,
  createOrderInputSchema,
  updateOrderInputSchema,
} from './orders.schema';

const updateStatusBodySchema = z.object({
  status: z.string().optional(),
  paymentMethod: z.string().optional(),
  isPaid: z.boolean().optional(),
  isSentToKitchen: z.boolean().optional(),
  customerName: z.string().max(100).optional(),
  isDelivery: z.boolean().optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryPhone: z.string().max(30).optional(),
  cancellationNote: z.string().max(500).optional(),
  items: z.array(z.any()).optional(),
});

const router = Router();
router.use(authenticate);
router.use(requireModule("caja"));

// ─── ORDERS ROUTES (UNIFICADO E HÍBRIDO) ─────────────────────────────────

/**
 * GET /api/orders
 * Listar órdenes con filtros opcionales
 */
router.get('/', async (req, res, next) => {
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
router.get('/:id', async (req, res, next) => {
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
router.post('/', async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const validatedBody = createOrderInputSchema.parse(req.body);

    const order = await ordersService.createOrder(tenantId, {
      ...validatedBody,
      userId: req.auth!.userId,
    });
    
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/orders/:id
 * Actualizar orden (HÍBRIDO)
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = String(req.params.id);
    const validatedBody = updateOrderInputSchema.parse(req.body);

    const order = await ordersService.updateOrder(tenantId, orderId, validatedBody);
    
    res.json(order);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/orders/:id
 * Eliminar orden
 */
router.delete('/:id', requireRole("OWNER", "MANAGER", "CASHIER"), async (req, res, next) => {
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
router.post('/:id/kitchen', async (req, res, next) => {
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
router.patch('/:id/status', async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const orderId = String(req.params.id);
    const { status, paymentMethod, isPaid, ...orderData } = updateStatusBodySchema.parse(req.body);

    const order = await ordersService.updateStatus(
      tenantId, 
      orderId, 
      status ?? "", 
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
router.patch('/:id/cadete', async (req, res, next) => {
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
router.patch('/:id/coords', async (req, res, next) => {
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
router.get('/shift/:shiftId/next-number', async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const shiftId = String(req.params.shiftId);

    const nextNumber = await ordersService.getNextOrderNumber(tenantId, shiftId);
    res.json({ nextNumber });
  } catch (error) {
    next(error);
  }
});

router.get('/kitchen/stats', async (req, res, next) => {
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
router.get('/kitchen/list', async (req, res, next) => {
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