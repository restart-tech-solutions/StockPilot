import { Router } from "express";

import {
  createInvoiceFromSalesOrder,
  downloadInvoicePdf,
  getInvoice,
  getInvoiceForSalesOrder,
  listAvailableSalesOrders,
  listInvoices,
  recordInvoicePayment,
} from "./invoice.controller";
import {
  authenticateUser,
  requireBusinessAccess,
} from "../../middleware/auth.middleware";

const router = Router();
const readAccess = requireBusinessAccess();
const invoiceAccess = requireBusinessAccess(
  "BUSINESS_OWNER",
  "SALES_EMPLOYEE"
);
const paymentAccess = requireBusinessAccess(
  "BUSINESS_OWNER",
  "ACCOUNTANT",
  "SALES_EMPLOYEE"
);

router.get("/available-sales", authenticateUser, readAccess, listAvailableSalesOrders);
router.get(
  "/by-sales-order/:salesOrderId",
  authenticateUser,
  readAccess,
  getInvoiceForSalesOrder
);
router.get("/", authenticateUser, readAccess, listInvoices);
router.post(
  "/from-sales/:salesOrderId",
  authenticateUser,
  invoiceAccess,
  createInvoiceFromSalesOrder
);
router.get("/:invoiceId/pdf", authenticateUser, readAccess, downloadInvoicePdf);
router.get("/:invoiceId", authenticateUser, readAccess, getInvoice);
router.post(
  "/:invoiceId/payments",
  authenticateUser,
  paymentAccess,
  recordInvoicePayment
);

export default router;
