import { Response } from "express";
import mongoose from "mongoose";
import ExcelJS from "exceljs";
import { Readable } from "stream";

import Product from "../../models/Product";
import Category from "../../models/Category";
import InventoryMovement from "../../models/InventoryMovement";
import Supplier from "../../models/Supplier";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { recordAuditLog } from "../../services/auditLog.service";
import { syncStockAlert } from "../../services/stockAlert.service";

interface ImportError {
  row: number;
  sku?: string;
  message: string;
}

function normalizeImportCell(value: unknown): unknown {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) return value.toISOString();

  if (typeof value !== "object") return value;

  const cellValue = value as Record<string, unknown>;

  if (Array.isArray(cellValue.richText)) {
    return cellValue.richText
      .map((part: any) => String(part.text ?? ""))
      .join("");
  }

  if (typeof cellValue.text === "string") {
    return cellValue.text;
  }

  if ("result" in cellValue) {
    return normalizeImportCell(cellValue.result);
  }

  return String(value);
}

function worksheetToRows(
  worksheet: ExcelJS.Worksheet
): Array<{ rowNumber: number; data: Record<string, unknown> }> {
  const headers: string[] = [];

  const headerRow = worksheet.getRow(1);

  for (let column = 1; column <= headerRow.cellCount; column++) {
    headers.push(
      String(normalizeImportCell(headerRow.getCell(column).value) ?? "").trim()
    );
  }

  const rows: Array<{
    rowNumber: number;
    data: Record<string, unknown>;
  }> = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const data: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      if (!header) return;

      data[header] = normalizeImportCell(
        row.getCell(index + 1).value
      );
    });

    if (
      Object.values(data).every(
        (value) => value === "" || value === null
      )
    ) {
      return;
    }

    rows.push({ rowNumber, data });
  });

  return rows;
}



export const importProducts = async (
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

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Please upload an Excel or CSV file.",
      });
      return;
    }

    const allowedExtensions = [".xlsx", ".csv"];

    const extension = req.file.originalname
      .slice(req.file.originalname.lastIndexOf("."))
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      res.status(400).json({
        success: false,
        message: "Only XLSX and CSV files are supported.",
      });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    let worksheet: ExcelJS.Worksheet | undefined;

    if (extension === ".csv") {
      worksheet = await workbook.csv.read(
        Readable.from([req.file.buffer])
      );
    } else {
await workbook.xlsx.load(Buffer.from(req.file.buffer) as any);      worksheet = workbook.worksheets[0];
    }

    if (!worksheet) {
      res.status(400).json({
        success: false,
        message: "The uploaded file does not contain a worksheet.",
      });
      return;
    }

    const rows = worksheetToRows(worksheet);

    if (rows.length === 0) {
      res.status(400).json({
        success: false,
        message: "The uploaded file contains no product records.",
      });
      return;
    }

    const errors: ImportError[] = [];

    const validRows: Array<{
      rowNumber: number;
      data: Record<string, unknown>;
      sku: string;
      categoryId: string;
      supplierId?: string;
      openingStock: number;
    }> = [];

    const seenSkus = new Set<string>();
    const categoryCache = new Map<string, boolean>();
    const supplierCache = new Map<string, boolean>();

    for (const item of rows) {
      const row = item.data;
      const rowNumber = item.rowNumber;

      const productName = String(row.productName ?? "").trim();
      const sku = String(row.sku ?? "").trim().toUpperCase();
      const categoryId = String(row.category ?? "").trim();
      const supplierId = String(row.supplier ?? "").trim();

      const purchasePrice = Number(row.purchasePrice);
      const sellingPrice = Number(row.sellingPrice);

      const openingStock =
        row.openingStock === "" || row.openingStock === undefined
          ? 0
          : Number(row.openingStock);

      const minimumStockThreshold =
        row.minimumStockThreshold === ""
          ? 0
          : Number(row.minimumStockThreshold);

      const rowError = (message: string) => {
        errors.push({ row: rowNumber, sku, message });
      };

      if (
        !productName ||
        !sku ||
        !categoryId ||
        row.purchasePrice === "" ||
        row.sellingPrice === ""
      ) {
        rowError(
          "Product name, SKU, category, purchase price and selling price are required."
        );
        continue;
      }

      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        rowError("Invalid category ID.");
        continue;
      }

      if (
        !Number.isFinite(purchasePrice) ||
        purchasePrice < 0 ||
        !Number.isFinite(sellingPrice) ||
        sellingPrice < 0 ||
        !Number.isFinite(openingStock) ||
        openingStock < 0 ||
        !Number.isFinite(minimumStockThreshold) ||
        minimumStockThreshold < 0
      ) {
        rowError(
          "Prices and stock values must be valid non-negative numbers."
        );
        continue;
      }

      if (seenSkus.has(sku)) {
        rowError("Duplicate SKU found in the uploaded file.");
        continue;
      }

      seenSkus.add(sku);

      if (!categoryCache.has(categoryId)) {
        const categoryExists = await Category.exists({
          _id: categoryId,
          businessId,
        });

        categoryCache.set(categoryId, Boolean(categoryExists));
      }

      if (!categoryCache.get(categoryId)) {
        rowError("Category not found in this business.");
        continue;
      }

      if (supplierId) {
        if (!mongoose.Types.ObjectId.isValid(supplierId)) {
          rowError("Invalid supplier ID.");
          continue;
        }

        if (!supplierCache.has(supplierId)) {
          const supplierExists = await Supplier.exists({
            _id: supplierId,
            businessId,
          });

          supplierCache.set(supplierId, Boolean(supplierExists));
        }

        if (!supplierCache.get(supplierId)) {
          rowError("Supplier not found in this business.");
          continue;
        }
      }

      validRows.push({
        rowNumber,
        data: row,
        sku,
        categoryId,
        ...(supplierId ? { supplierId } : {}),
        openingStock,
      });
    }

    const importedProducts: Array<{
      row: number;
      sku: string;
    }> = [];

    const importedIds: mongoose.Types.ObjectId[] = [];

    for (const item of validRows) {
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          const existingProduct = await Product.findOne({
            businessId,
            sku: item.sku,
          }).session(session);

          if (existingProduct) {
            throw new Error("This SKU already exists in your business.");
          }

          const row = item.data;

          const product = new Product({
            businessId,
            productName: String(row.productName).trim(),
            sku: item.sku,
            barcode: row.barcode ? String(row.barcode).trim() : undefined,
            category: item.categoryId,
            brand: row.brand ? String(row.brand).trim() : undefined,
            purchasePrice: Number(row.purchasePrice),
            sellingPrice: Number(row.sellingPrice),
            currentStock: item.openingStock,
            minimumStockThreshold:
              row.minimumStockThreshold === ""
                ? 0
                : Number(row.minimumStockThreshold),
            supplier: item.supplierId,
            productDescription: row.productDescription
              ? String(row.productDescription).trim()
              : undefined,
            productImage: row.productImage
              ? String(row.productImage).trim()
              : undefined,
          });

          await product.save({ session });

          if (item.openingStock > 0) {
            await InventoryMovement.create(
              [
                {
                  businessId,
                  productId: product._id,
                  movementType: "OPENING_STOCK",
                  quantity: item.openingStock,
                  previousStock: 0,
                  newStock: item.openingStock,
                  performedBy: req.user?.userId,
                },
              ],
              { session }
            );
          }

          await syncStockAlert(product, session);

          if (req.user?.userId) {
            await recordAuditLog(
              {
                businessId,
                actorUserId: req.user.userId,
                action: "PRODUCT_IMPORTED",
                resourceType: "PRODUCT",
                resourceId: product._id,
                description: `Imported product ${product.productName} (${product.sku}) with opening stock ${item.openingStock}.`,
              },
              session
            );
          }

          importedIds.push(product._id);
        });

        importedProducts.push({
          row: item.rowNumber,
          sku: item.sku,
        });
      } catch (error: any) {
        errors.push({
          row: item.rowNumber,
          sku: item.sku,
          message:
            error.code === 11000
              ? "This SKU already exists in your business."
              : "Failed to import this product.",
        });
      } finally {
        await session.endSession();
      }
    }

    res.status(200).json({
      success: true,
      message: "Product import processing completed.",
      summary: {
        totalRows: rows.length,
        imported: importedProducts.length,
        failed: errors.length,
      },
      importedProducts,
      errors,
    });
  } catch (error) {
    console.error("Product Import Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to process product import.",
    });
  }
};
