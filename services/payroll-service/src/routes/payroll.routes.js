import { Router } from 'express';
import { requireAuth, requireRole } from '../common/requireRole.js';
import { requireFields } from '../common/validate.js';
import { STAFF } from '../common/roles.js';
import { setSalary, getSalary, generatePayslip, myPayslips, listPayslips, getPayslip } from '../controllers/payroll.controller.js';

const router = Router();

// Mounted at /api/payroll. Keep '/payslips/me' BEFORE '/payslips/:id'.
router.put('/salary/:userId', requireRole(...STAFF), requireFields('baseSalary'), setSalary);
router.get('/salary/:userId', requireAuth, getSalary);
router.post('/generate', requireRole(...STAFF), requireFields('userId', 'month'), generatePayslip);
router.get('/payslips/me', requireAuth, myPayslips);
router.get('/payslips', requireRole(...STAFF), listPayslips);
router.get('/payslips/:id', requireAuth, getPayslip);

export default router;
