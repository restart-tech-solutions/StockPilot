import { Response } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";

import Business from "../../models/Business";
import Customer from "../../models/Customer";
import Invoice, {
  IInvoiceItem,
  InvoicePaymentStatus,
} from "../../models/Invoice";
import InvoicePayment, {
  InvoicePaymentMethod,
  invoicePaymentMethods,
} from "../../models/InvoicePayment";
import SalesOrder from "../../models/SalesOrder";
import TaxInvoiceSettings from "../../models/TaxInvoiceSettings";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { recordAuditLog } from "../../services/auditLog.service";
import {
  escapeRegex,
  isDuplicateKeyError,
  isRecord,
  parsePagination,
} from "../../utils/resourceQuery";

class InvoiceWorkflowError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

interface PaymentInput {
  amount: number;
  paymentMethod: InvoicePaymentMethod;
  reference?: string;
  note?: string;
}

const invoiceStatuses: InvoicePaymentStatus[] = [
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
];
const completedSalesStatuses = [
  "COMPLETED",
  "PARTIALLY_RETURNED",
  "RETURNED",
] as const;

const getInvoiceId = (req: AuthenticatedRequest): string =>
  typeof req.params.invoiceId === "string" ? req.params.invoiceId : "";

const getSalesOrderId = (req: AuthenticatedRequest): string =>
  typeof req.params.salesOrderId === "string" ? req.params.salesOrderId : "";

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const parseDateFilter = (value: unknown, endOfDay: boolean): Date | null => {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(Number.NaN);
  }
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? new Date(Number.NaN)
    : date;
};

const parsePaymentInput = (body: unknown): PaymentInput | null => {
  if (
    !isRecord(body) ||
    typeof body.amount !== "number" ||
    !Number.isFinite(body.amount) ||
    body.amount <= 0 ||
    Math.abs(body.amount * 100 - Math.round(body.amount * 100)) > 1e-7 ||
    typeof body.paymentMethod !== "string" ||
    !invoicePaymentMethods.includes(
      body.paymentMethod as InvoicePaymentMethod
    ) ||
    (body.reference !== undefined && typeof body.reference !== "string") ||
    (body.note !== undefined && typeof body.note !== "string")
  ) {
    return null;
  }
  const reference =
    typeof body.reference === "string" ? body.reference.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (reference.length > 100 || note.length > 500) return null;

  return {
    amount: roundMoney(body.amount),
    paymentMethod: body.paymentMethod as InvoicePaymentMethod,
    ...(reference ? { reference } : {}),
    ...(note ? { note } : {}),
  };
};

const formatInvoiceDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

const formatPdfAmount = (amount: number, currency: string): string => {
  const normalizedCurrency = currency?.trim().toUpperCase() ?? "";
  const currencyCode = /^[A-Z]{3}$/.test(normalizedCurrency)
    ? normalizedCurrency
    : "INR";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
};
export const listAvailableSalesOrders = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    const pagination = parsePagination(req.query.page, req.query.limit);
    if (!pagination) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination values.",
      });
      return;
    }
    const { search, salesOrderId } = req.query;
    if (
      (search !== undefined && typeof search !== "string") ||
      (salesOrderId !== undefined && typeof salesOrderId !== "string")
    ) {
      res.status(400).json({
        success: false,
        message: "Invoice source filters must be strings.",
      });
      return;
    }

    const filter: Record<string, unknown> = {
      businessId,
      status: { $in: completedSalesStatuses },
      completedAt: { $exists: true },
      invoiceId: { $exists: false },
    };
    if (typeof salesOrderId === "string" && salesOrderId.trim()) {
      if (!mongoose.Types.ObjectId.isValid(salesOrderId)) {
        res.status(400).json({
          success: false,
          message: "Invalid sales order ID.",
        });
        return;
      }
      filter._id = salesOrderId;
    }
    if (typeof search === "string" && search.trim()) {
      const expression = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [
        { salesOrderNumber: expression },
        { customerName: expression },
      ];
    }

    const [salesOrders, total] = await Promise.all([
      SalesOrder.find(filter)
        .select(
          "salesOrderNumber customerName completedAt totalAmount status"
        )
        .sort({ completedAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      SalesOrder.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      salesOrders,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Invoice Source Sales Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list sales orders available for invoicing.",
    });
  }
};

export const getInvoiceForSalesOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    const salesOrderId = getSalesOrderId(req);
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(salesOrderId)) {
      res.status(400).json({ success: false, message: "Invalid sales order ID." });
      return;
    }
    const invoice = await Invoice.findOne({ businessId, salesOrderId })
      .select("_id invoiceNumber paymentStatus")
      .lean();
    res.status(200).json({ success: true, invoice: invoice ?? null });
  } catch (error) {
    console.error("Get Invoice by Sales Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve the sales order invoice.",
    });
  }
};

export const createInvoiceFromSalesOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const createdBy = req.user?.userId;
  const salesOrderId = getSalesOrderId(req);
  if (!businessId || !createdBy) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(salesOrderId)) {
    res.status(400).json({ success: false, message: "Invalid sales order ID." });
    return;
  }

  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    const activeSession = session;
    let createdInvoice: InstanceType<typeof Invoice> | undefined;
    await activeSession.withTransaction(async () => {
      const sale = await SalesOrder.findOne({
        _id: salesOrderId,
        businessId,
      }).session(activeSession);
      if (!sale) {
        throw new InvoiceWorkflowError(404, "Sales order not found.");
      }
      if (!completedSalesStatuses.includes(sale.status as (typeof completedSalesStatuses)[number]) || !sale.completedAt) {
        throw new InvoiceWorkflowError(
          409,
          "An invoice can only be generated from a completed sales order."
        );
      }
      if (sale.invoiceId) {
        throw new InvoiceWorkflowError(
          409,
          "An invoice has already been generated for this sales order."
        );
      }
      const existingInvoice = await Invoice.exists({
        businessId,
        salesOrderId,
      }).session(activeSession);
      if (existingInvoice) {
        throw new InvoiceWorkflowError(
          409,
          "An invoice has already been generated for this sales order."
        );
      }

      const business = await Business.findById(businessId).session(activeSession);
      if (!business) {
        throw new InvoiceWorkflowError(404, "Business workspace not found.");
      }
      const customer = await Customer.findOne({
        _id: sale.customerId,
        businessId,
      }).session(activeSession);
      const settings = await TaxInvoiceSettings.findOneAndUpdate(
        { businessId },
        { $inc: { lastInvoiceSequence: 1 } },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
          setDefaultsOnInsert: true,
          session: activeSession,
        }
      );
      if (!settings) {
        throw new Error("Invoice sequence could not be allocated.");
      }

      const invoiceDate = new Date();
      const prefix = settings.invoicePrefix.trim().toUpperCase();
      const invoiceNumber = `${prefix}-${invoiceDate
        .getUTCFullYear()
        .toString()}-${settings.lastInvoiceSequence.toString().padStart(6, "0")}`;
      const rawTaxCents = sale.products.map((line) => ({
        cents: (line.taxableAmount * sale.taxPercentage) / 100 * 100,
        remainder:
          ((line.taxableAmount * sale.taxPercentage) / 100) * 100 -
          Math.floor(
            ((line.taxableAmount * sale.taxPercentage) / 100) * 100
          ),
      }));
      const lineTaxCents = rawTaxCents.map((line) => Math.floor(line.cents));
      let centsToAllocate =
        Math.round(sale.tax * 100) -
        lineTaxCents.reduce((sum, cents) => sum + cents, 0);
      const remainderOrder = rawTaxCents
        .map((line, index) => ({ index, remainder: line.remainder }))
        .sort((left, right) => right.remainder - left.remainder);
      for (let index = 0; index < centsToAllocate; index += 1) {
        const target = remainderOrder[index];
        if (target) lineTaxCents[target.index] += 1;
      }

      const invoiceProducts: IInvoiceItem[] = sale.products.map(
        (line, index) => {
          const taxAmount = (lineTaxCents[index] ?? 0) / 100;
          return {
            productId: line.productId,
            productName: line.productName,
            sku: line.sku,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPercentage: line.discountPercentage,
            subtotal: line.subtotal,
            discountAmount: line.discountAmount,
            taxableAmount: line.taxableAmount,
            taxAmount,
            lineTotal: roundMoney(line.taxableAmount + taxAmount),
          };
        }
      );
      const invoice = new Invoice({
        businessId,
        invoiceNumber,
        invoiceDate,
        currency: business.currency,
        businessName: business.businessName,
        businessLocation: business.location,
        businessEmail: business.contactDetails.email,
        businessPhone: business.contactDetails.phone,
        salesOrderId: sale._id,
        salesOrderNumber: sale.salesOrderNumber,
        customerId: sale.customerId,
        customerName: sale.customerName,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
        customerAddress: customer?.address,
        products: invoiceProducts,
        subtotal: sale.subtotal,
        discountTotal: sale.discountTotal,
        taxableAmount: sale.taxableAmount,
        taxName: sale.taxName || settings.taxName,
        taxPercentage: sale.taxPercentage,
        tax: sale.tax,
        totalAmount: sale.totalAmount,
        amountPaid: 0,
        balanceDue: sale.totalAmount,
        paymentStatus: sale.totalAmount === 0 ? "PAID" : "UNPAID",
        ...(sale.totalAmount === 0 ? { paidAt: invoiceDate } : {}),
        createdBy,
      });
      await invoice.save({ session: activeSession });
      sale.invoiceId = invoice._id;
      await sale.save({ session: activeSession });
      await recordAuditLog(
        {
          businessId,
          actorUserId: createdBy,
          action: "INVOICE_CREATED",
          resourceType: "INVOICE",
          resourceId: invoice._id,
          description: `Generated invoice ${invoice.invoiceNumber} from sales order ${sale.salesOrderNumber}.`,
        },
        activeSession
      );
      createdInvoice = invoice;
    });

    if (!createdInvoice) {
      res.status(500).json({
        success: false,
        message: "Invoice generation did not finish.",
      });
      return;
    }
    res.status(201).json({
      success: true,
      message: "Invoice generated successfully.",
      invoice: createdInvoice,
    });
  } catch (error) {
    if (error instanceof InvoiceWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "An invoice already exists for this sales order or invoice number.",
      });
      return;
    }
    console.error("Create Invoice from Sales Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate invoice.",
    });
  } finally {
    if (session) await session.endSession();
  }
};

export const listInvoices = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    const pagination = parsePagination(req.query.page, req.query.limit);
    if (!pagination) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination values.",
      });
      return;
    }
    const { search, status, from, to } = req.query;
    if (
      (search !== undefined && typeof search !== "string") ||
      (status !== undefined && typeof status !== "string") ||
      (from !== undefined && typeof from !== "string") ||
      (to !== undefined && typeof to !== "string")
    ) {
      res.status(400).json({
        success: false,
        message: "Invoice filters must be strings.",
      });
      return;
    }
    const fromDate = parseDateFilter(from, false);
    const toDate = parseDateFilter(to, true);
    if (
      (fromDate && Number.isNaN(fromDate.getTime())) ||
      (toDate && Number.isNaN(toDate.getTime())) ||
      (fromDate && toDate && fromDate > toDate)
    ) {
      res.status(400).json({
        success: false,
        message: "Provide a valid invoice date range.",
      });
      return;
    }

    const filter: Record<string, unknown> = { businessId };
    if (typeof search === "string" && search.trim()) {
      const expression = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [
        { invoiceNumber: expression },
        { customerName: expression },
        { salesOrderNumber: expression },
      ];
    }
    if (typeof status === "string" && status.trim()) {
      if (!invoiceStatuses.includes(status as InvoicePaymentStatus)) {
        res.status(400).json({
          success: false,
          message: "Invalid invoice payment status.",
        });
        return;
      }
      filter.paymentStatus = status;
    }
    if (fromDate || toDate) {
      filter.invoiceDate = {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toDate ? { $lte: toDate } : {}),
      };
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .select(
          "invoiceNumber invoiceDate customerName totalAmount amountPaid balanceDue currency paymentStatus salesOrderNumber"
        )
        .sort({ invoiceDate: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      invoices,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    console.error("List Invoices Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list invoices.",
    });
  }
};

const findInvoiceForBusiness = async (
  invoiceId: string,
  businessId: string
) => {
  if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
    throw new InvoiceWorkflowError(400, "Invalid invoice ID.");
  }
  const invoice = await Invoice.findOne({ _id: invoiceId, businessId }).lean();
  if (!invoice) {
    throw new InvoiceWorkflowError(404, "Invoice not found.");
  }
  return invoice;
};

export const getInvoice = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    const invoice = await findInvoiceForBusiness(getInvoiceId(req), businessId);
    const payments = await InvoicePayment.find({
      businessId,
      invoiceId: invoice._id,
    })
      .populate({ path: "recordedBy", select: "name email" })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    res.status(200).json({ success: true, invoice, payments });
  } catch (error) {
    if (error instanceof InvoiceWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    console.error("Get Invoice Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve invoice.",
    });
  }
};

export const recordInvoicePayment = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const businessId = req.businessMembership?.businessId;
  const recordedBy = req.user?.userId;
  const invoiceId = getInvoiceId(req);
  const idempotencyKey = req.get("Idempotency-Key")?.trim();
  const input = parsePaymentInput(req.body);
  if (!businessId || !recordedBy) {
    res.status(403).json({
      success: false,
      message: "You do not have access to this business.",
    });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
    res.status(400).json({ success: false, message: "Invalid invoice ID." });
    return;
  }
  if (!idempotencyKey || idempotencyKey.length > 120) {
    res.status(400).json({
      success: false,
      message: "A valid Idempotency-Key header is required.",
    });
    return;
  }
  if (!input) {
    res.status(400).json({
      success: false,
      message: "Provide a positive payment amount in currency units and a supported payment method.",
    });
    return;
  }

  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    const activeSession = session;
    let payment: InstanceType<typeof InvoicePayment> | undefined;
    let updatedInvoice: InstanceType<typeof Invoice> | null = null;
    await activeSession.withTransaction(async () => {
      const duplicate = await InvoicePayment.exists({
        businessId,
        idempotencyKey,
      }).session(activeSession);
      if (duplicate) {
        throw new InvoiceWorkflowError(
          409,
          "This payment has already been recorded."
        );
      }
      if (input.reference) {
  const duplicateReference = await InvoicePayment.exists({
    businessId,
    paymentMethod: input.paymentMethod,
    reference: input.reference,
  }).session(activeSession);

  if (duplicateReference) {
    throw new InvoiceWorkflowError(
      409,
      "This payment reference has already been recorded."
    );
  }
}
      const invoice = await Invoice.findOne({
        _id: invoiceId,
        businessId,
      }).session(activeSession);
      if (!invoice) {
        throw new InvoiceWorkflowError(404, "Invoice not found.");
      }
      if (invoice.paymentStatus === "PAID" || invoice.balanceDue <= 0) {
        throw new InvoiceWorkflowError(
          409,
          "This invoice has no outstanding balance."
        );
      }
      if (input.amount > invoice.balanceDue + Number.EPSILON) {
        throw new InvoiceWorkflowError(
          409,
          "Payment amount cannot exceed the outstanding balance."
        );
      }

      const amountPaid = roundMoney(invoice.amountPaid + input.amount);
      const balanceDue = roundMoney(invoice.totalAmount - amountPaid);
      const paymentStatus: InvoicePaymentStatus =
        balanceDue === 0
          ? "PAID"
          : amountPaid > 0
            ? "PARTIALLY_PAID"
            : "UNPAID";
      const paymentDate = new Date();
      const updated = await Invoice.findOneAndUpdate(
        {
          _id: invoice._id,
          businessId,
          amountPaid: invoice.amountPaid,
          balanceDue: { $gte: input.amount },
        },
        {
          $set: {
            amountPaid,
            balanceDue,
            paymentStatus,
            lastPaymentAt: paymentDate,
            ...(paymentStatus === "PAID" ? { paidAt: paymentDate } : {}),
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session: activeSession,
        }
      );
      if (!updated) {
        throw new InvoiceWorkflowError(
          409,
          "The invoice balance changed; reload it and retry the payment."
        );
      }

      const paymentRecord = new InvoicePayment({
        businessId,
        invoiceId: invoice._id,
        idempotencyKey,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        reference: input.reference,
        note: input.note,
        recordedBy,
      });
      await paymentRecord.save({ session: activeSession });
      await recordAuditLog(
        {
          businessId,
          actorUserId: recordedBy,
          action: "INVOICE_PAYMENT_RECORDED",
          resourceType: "INVOICE_PAYMENT",
          resourceId: paymentRecord._id,
          description: `Recorded a ${input.paymentMethod} payment of ${input.amount} for invoice ${invoice.invoiceNumber}.`,
        },
        activeSession
      );
      payment = paymentRecord;
      updatedInvoice = updated;
    });

    if (!payment || !updatedInvoice) {
      res.status(500).json({
        success: false,
        message: "Payment recording did not finish.",
      });
      return;
    }
    res.status(201).json({
      success: true,
      message: "Payment recorded successfully.",
      payment,
      invoice: updatedInvoice,
    });
  } catch (error) {
    if (error instanceof InvoiceWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    if (isDuplicateKeyError(error)) {
      res.status(409).json({
        success: false,
        message: "This payment or payment reference has already been recorded.",
      });
      return;
    }
    console.error("Record Invoice Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record invoice payment.",
    });
  } finally {
    if (session) await session.endSession();
  }
};

export const downloadInvoicePdf = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const businessId = req.businessMembership?.businessId;
    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this business.",
      });
      return;
    }
    const invoice = await findInvoiceForBusiness(getInvoiceId(req), businessId);
    const payments = await InvoicePayment.find({ businessId, invoiceId: invoice._id })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const filename = invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]/g, "_");
    const document = new PDFDocument({ size: "A4", margin: 48 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.pdf"`
    );
    document.on("error", (error: Error) => {
      console.error("Generate Invoice PDF Error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Failed to generate invoice PDF.",
        });
      } else {
        res.destroy(error);
      }
    });
    document.pipe(res);

    const margin = 48;
    const pageWidth = document.page.width;
    const contentWidth = pageWidth - margin * 2;
    const rightEdge = pageWidth - margin;
    const ensureSpace = (height: number) => {
      if (document.y + height > document.page.height - margin) {
        document.addPage();
      }
    };
    const line = (y: number) => {
      document
        .moveTo(margin, y)
        .lineTo(rightEdge, y)
        .lineWidth(0.5)
        .strokeColor("#CBD5E1")
        .stroke();
    };

    document
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#0F2747")
      .text(invoice.businessName, margin, document.y, {
        width: contentWidth,
      });
    document
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#475569")
      .text(invoice.businessLocation, { width: contentWidth });
    if (invoice.businessEmail) {
      document.text(invoice.businessEmail, { width: contentWidth });
    }
    if (invoice.businessPhone) {
      document.text(invoice.businessPhone, { width: contentWidth });
    }
    document.moveDown(0.7);
    document
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#1D4ED8")
      .text("INVOICE", margin, document.y);
    document
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#0F172A")
      .text(`Invoice number: ${invoice.invoiceNumber}`)
      .text(`Invoice date: ${formatInvoiceDate(invoice.invoiceDate)}`)
      .text(`Sales order: ${invoice.salesOrderNumber}`);
    document.moveDown(0.8);

    document.font("Helvetica-Bold").fontSize(11).text("Bill to");
    document.font("Helvetica").fontSize(10).text(invoice.customerName);
    if (invoice.customerAddress) document.text(invoice.customerAddress);
    if (invoice.customerEmail) document.text(invoice.customerEmail);
    if (invoice.customerPhone) document.text(invoice.customerPhone);
    document.moveDown(1);

    ensureSpace(32);
    const headerY = document.y;
    document
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#0F2747")
      .text("Product", margin, headerY, { width: 178 })
      .text("Qty", margin + 180, headerY, { width: 34, align: "right" })
      .text("Unit", margin + 218, headerY, { width: 62, align: "right" })
      .text("Discount", margin + 284, headerY, { width: 56, align: "right" })
      .text("Tax", margin + 344, headerY, { width: 52, align: "right" })
      .text("Amount", margin + 400, headerY, {
        width: contentWidth - 400,
        align: "right",
      });
    document.y = headerY + 17;
    line(document.y);
    document.y += 7;

    document.font("Helvetica").fontSize(8);
    for (const item of invoice.products) {
      const description = `${item.productName} (${item.sku})`;
      const descriptionHeight = document.heightOfString(description, {
        width: 178,
      });
      const rowHeight = Math.max(24, descriptionHeight + 8);
      ensureSpace(rowHeight + 2);
      const rowY = document.y;
      document
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#0F172A")
        .text(description, margin, rowY, { width: 178 })
        .text(String(item.quantity), margin + 180, rowY, {
          width: 34,
          align: "right",
        })
        .text(formatPdfAmount(item.unitPrice, invoice.currency), margin + 218, rowY, {
          width: 62,
          align: "right",
        })
        .text(formatPdfAmount(item.discountAmount, invoice.currency), margin + 284, rowY, {
          width: 56,
          align: "right",
        })
        .text(formatPdfAmount(item.taxAmount, invoice.currency), margin + 344, rowY, {
          width: 52,
          align: "right",
        })
        .text(formatPdfAmount(item.lineTotal, invoice.currency), margin + 400, rowY, {
          width: contentWidth - 400,
          align: "right",
        });
      document.y = rowY + rowHeight;
      line(document.y);
      document.y += 6;
    }

    ensureSpace(126);
    document.moveDown(0.5);
    const summaryX = margin + 250;
    const summaryWidth = contentWidth - 250;
    const writeSummary = (label: string, value: string, bold = false) => {
      document
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 11 : 9)
        .fillColor("#0F172A")
        .text(label, summaryX, document.y, { width: summaryWidth / 2 })
        .text(value, summaryX + summaryWidth / 2, document.y, {
          width: summaryWidth / 2,
          align: "right",
        });
      document.moveDown(0.35);
    };
    writeSummary("Subtotal", formatPdfAmount(invoice.subtotal, invoice.currency));
    writeSummary(
      "Discount",
      formatPdfAmount(invoice.discountTotal, invoice.currency)
    );
    writeSummary(
      `${invoice.taxName} (${invoice.taxPercentage}%)`,
      formatPdfAmount(invoice.tax, invoice.currency)
    );
    writeSummary(
      "Total payable",
      formatPdfAmount(invoice.totalAmount, invoice.currency),
      true
    );
    writeSummary(
      "Payment status",
      invoice.paymentStatus.replaceAll("_", " ")
    );
    writeSummary(
      "Amount paid",
      formatPdfAmount(invoice.amountPaid, invoice.currency)
    );
    writeSummary(
      "Balance due",
      formatPdfAmount(invoice.balanceDue, invoice.currency),
      true
    );

    if (payments.length > 0) {
      ensureSpace(35);
      document.moveDown(0.7);
      document.font("Helvetica-Bold").fontSize(10).text("Payment history");
      for (const payment of payments) {
        ensureSpace(20);
        document
          .font("Helvetica")
          .fontSize(8)
          .text(
            `${formatInvoiceDate(payment.createdAt)} · ${payment.paymentMethod.replaceAll("_", " ")} · ${formatPdfAmount(payment.amount, invoice.currency)}${payment.reference ? ` · ${payment.reference}` : ""}`,
            { width: contentWidth }
          );
      }
    }
    document.end();
  } catch (error) {
    if (error instanceof InvoiceWorkflowError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    console.error("Download Invoice PDF Error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to generate invoice PDF.",
      });
    } else {
      res.destroy(error instanceof Error ? error : undefined);
    }
  }
};

