import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '@/middleware/tenantGuard';
import * as service from './customers.service';
import * as schema from './customers.schema';

const router = Router();
router.use(authenticate);

// ─── CUSTOMER ROUTES ─────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.listCustomers(req.auth!.tenantId));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.getCustomerById(req.auth!.tenantId, String(req.params.id)));
  } catch (err) {
    next(err);
  }
});

router.get('/phone/:phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.getCustomerByPhone(req.auth!.tenantId, String(req.params.phone)));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = schema.createCustomerSchema.parse(req.body);
    res.json(await service.createCustomer(req.auth!.tenantId, data));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = schema.updateCustomerSchema.parse(req.body);
    res.json(await service.updateCustomer(req.auth!.tenantId, String(req.params.id), data));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteCustomer(req.auth!.tenantId, String(req.params.id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── ADDRESS ROUTES ──────────────────────────────────────────────────────────

router.post('/addresses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = schema.createAddressSchema.parse(req.body);
    res.json(await service.createAddress(req.auth!.tenantId, data));
  } catch (err) {
    next(err);
  }
});

router.patch('/addresses/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = schema.updateAddressSchema.parse(req.body);
    res.json(await service.updateAddress(req.auth!.tenantId, String(req.params.id), data));
  } catch (err) {
    next(err);
  }
});

router.delete('/addresses/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteAddress(req.auth!.tenantId, String(req.params.id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── TAG ROUTES ──────────────────────────────────────────────────────────────

router.post('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = schema.createTagSchema.parse(req.body);
    res.json(await service.createTag(req.auth!.tenantId, data));
  } catch (err) {
    next(err);
  }
});

router.delete('/tags/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteTag(req.auth!.tenantId, String(req.params.id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
