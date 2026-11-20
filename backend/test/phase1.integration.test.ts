process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "stockpilot-integration-test-secret";
const testMongoUri =
  process.env.MONGODB_TEST_URI ||
  "mongodb://127.0.0.1:27018/stockpilot_test?replicaSet=stockpilot-test-rs";
const testMongoTarget = new URL(testMongoUri);
const allowedTestHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
if (
  testMongoTarget.protocol !== "mongodb:" ||
  !allowedTestHosts.has(testMongoTarget.hostname) ||
  decodeURIComponent(testMongoTarget.pathname.slice(1).split("/")[0] ?? "") !==
    "stockpilot_test"
) {
  throw new Error(
    "Tests require the loopback stockpilot_test database; refusing an unsafe MongoDB target."
  );
}
process.env.MONGODB_URI =
  testMongoUri;

import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import ExcelJS from "exceljs";
import { createHash } from "crypto";

import app from "../src/app";
import User from "../src/models/User";
import Business from "../src/models/Business";
import Membership from "../src/models/Membership";
import Category from "../src/models/Category";
import Warehouse from "../src/models/Warehouse";
import MeasurementUnit from "../src/models/MeasurementUnit";
import TaxInvoiceSettings from "../src/models/TaxInvoiceSettings";
import StockNotificationPreference from "../src/models/StockNotificationPreference";
import Product from "../src/models/Product";
import InventoryMovement from "../src/models/InventoryMovement";
import InventoryBalance from "../src/models/InventoryBalance";
import PurchaseOrder from "../src/models/PurchaseOrder";
import GoodsReceipt from "../src/models/GoodsReceipt";
import InventoryTransfer from "../src/models/InventoryTransfer";
import SalesOrder from "../src/models/SalesOrder";
import SalesReturn from "../src/models/SalesReturn";
import Invoice from "../src/models/Invoice";
import InvoicePayment from "../src/models/InvoicePayment";
import StockAlert from "../src/models/StockAlert";
import InAppNotification from "../src/models/InAppNotification";
import AuditLog from "../src/models/AuditLog";
import Supplier from "../src/models/Supplier";
import Customer from "../src/models/Customer";
import EmployeeInvitation from "../src/models/EmployeeInvitation";
let ownerToken = "";
let ownerId = "";
let ownerBusinessId = "";
let secondToken = "";
let secondId = "";
let secondBusinessId = "";

test("Phase 1 integration suite", async (suite) => {
  await suite.test("connects to the dedicated test database", async () => {
    await mongoose.connect(process.env.MONGODB_URI!);
    if (
      mongoose.connection.name !== "stockpilot_test" ||
      !allowedTestHosts.has(mongoose.connection.host)
    ) {
      await mongoose.disconnect();
      throw new Error(
        "Refusing to drop a database outside the loopback stockpilot_test target."
      );
    }
await mongoose.connection.dropDatabase();

assert.equal(mongoose.connection.readyState, 1);

// Recreate the unique inventory movement index after dropping the test database.
await InventoryMovement.createIndexes();  });

  await suite.test("authentication rejects missing and invalid tokens", async () => {
    const missing = await request(app).get("/api/auth/me");
    assert.equal(missing.status, 401);

    const invalid = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid.token");
    assert.equal(invalid.status, 401);
  });

  await suite.test("expired JWT is rejected", async () => {
    const expired = jwt.sign(
      { userId: new mongoose.Types.ObjectId().toString(), role: "BUSINESS_OWNER" },
      process.env.JWT_SECRET!,
      { expiresIn: -1 }
    );
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expired}`);
    assert.equal(response.status, 401);
  });

  await suite.test("registers, logs in and returns valid authentication", async () => {
    const ownerRegistration = await request(app).post("/api/auth/register").send({
      name: "Owner One",
      email: "owner1@stockpilot.test",
      password: "OwnerPass123!",
    });
    assert.equal(ownerRegistration.status, 201);
    ownerId = ownerRegistration.body.user.id;

    const ownerLogin = await request(app).post("/api/auth/login").send({
      email: "owner1@stockpilot.test",
      password: "OwnerPass123!",
    });
    assert.equal(ownerLogin.status, 200);
    ownerToken = ownerLogin.body.token;

    const secondRegistration = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Owner Two",
        email: "owner2@stockpilot.test",
        password: "OwnerPass123!",
      });
    assert.equal(secondRegistration.status, 201);
    secondId = secondRegistration.body.user.id;

    const secondLogin = await request(app).post("/api/auth/login").send({
      email: "owner2@stockpilot.test",
      password: "OwnerPass123!",
    });
    assert.equal(secondLogin.status, 200);
    secondToken = secondLogin.body.token;

    const valid = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(valid.status, 200);
  });

  await suite.test("creates isolated owner businesses and memberships", async () => {
    const ownerCreate = await request(app)
      .post("/api/business")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessName: "Owner One Store",
        contactDetails: { email: "owner1-store@stockpilot.test", phone: "111" },
        category: "Retail",
        location: "Test City",
        currency: "usd",
      });
    assert.equal(ownerCreate.status, 201);
    ownerBusinessId = ownerCreate.body.business.id;

    const ownerMembership = await Membership.findOne({
      userId: ownerId,
      businessId: ownerBusinessId,
    }).lean();
    assert.equal(ownerMembership?.role, "BUSINESS_OWNER");

    const secondCreate = await request(app)
      .post("/api/business")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessName: "Owner Two Store",
        contactDetails: { email: "owner2-store@stockpilot.test", phone: "222" },
        category: "Wholesale",
        location: "Test City",
        currency: "usd",
      });
    assert.equal(secondCreate.status, 201);
    secondBusinessId = secondCreate.body.business.id;
  });

  await suite.test("lists and retrieves only accessible businesses", async () => {
    const list = await request(app)
      .get("/api/business")
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.businesses.length, 1);
    assert.equal(list.body.businesses[0].id, ownerBusinessId);

    const retrieve = await request(app)
      .get(`/api/business/${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(retrieve.status, 200);

    const crossBusiness = await request(app)
      .get(`/api/business/${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(crossBusiness.status, 403);

    await Membership.create({
      userId: secondId,
      businessId: ownerBusinessId,
      role: "ACCOUNTANT",
    });

    const insufficientRole = await request(app)
      .put(`/api/business/${ownerBusinessId}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessName: "Unauthorized Update" });
    assert.equal(insufficientRole.status, 403);
  });

  await suite.test("restricts and completes business workspace updates", async () => {
    const crossUpdate = await request(app)
      .put(`/api/business/${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessName: "Unauthorized" });
    assert.equal(crossUpdate.status, 403);

    const update = await request(app)
      .put(`/api/business/${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessName: "Owner One Updated", currency: "eur" });
    assert.equal(update.status, 200);
  });

  let categoryId = "";
  await suite.test("creates, lists, retrieves and updates categories", async () => {
    const create = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        categoryName: "Electronics",
        description: "Electronic products",
      });
    assert.equal(create.status, 201);
    categoryId = create.body.category._id;

    const duplicate = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, categoryName: "electronics" });
    assert.equal(duplicate.status, 409);

    const list = await request(app)
      .get(`/api/categories?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.categories.length, 1);

    const retrieve = await request(app)
      .get(`/api/categories/${categoryId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(retrieve.status, 200);

    const update = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        categoryName: "Electronic Devices",
      });
    assert.equal(update.status, 200);

    const cross = await request(app)
      .get(`/api/categories/${categoryId}?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(cross.status, 403);
  });

  let warehouseId = "";
  await suite.test("completes warehouse CRUD and isolation", async () => {
    const create = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        warehouseName: "Main Warehouse",
        address: "1 Test Street",
        city: "Test City",
        contactNumber: "123456",
      });
    assert.equal(create.status, 201);
    warehouseId = create.body.warehouse._id;

    const duplicate = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        warehouseName: "main warehouse",
        address: "2 Test Street",
        city: "Test City",
        contactNumber: "654321",
      });
    assert.equal(duplicate.status, 409);

    const list = await request(app)
      .get(`/api/warehouses?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(list.status, 200);

    const retrieve = await request(app)
      .get(`/api/warehouses/${warehouseId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(retrieve.status, 200);

    const update = await request(app)
      .put(`/api/warehouses/${warehouseId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        address: "5 Updated Street",
      });
    assert.equal(update.status, 200);

    const cross = await request(app)
      .get(`/api/warehouses/${warehouseId}?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(cross.status, 403);
  });

  let unitId = "";
  await suite.test("completes measurement unit CRUD and duplicate checks", async () => {
    const create = await request(app)
      .post("/api/business/measurement-units")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        unitName: "Piece",
        unitSymbol: "pc",
      });
    assert.equal(create.status, 201);
    unitId = create.body.measurementUnit._id;

    const duplicateName = await request(app)
      .post("/api/business/measurement-units")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, unitName: "piece", unitSymbol: "pcs" });
    assert.equal(duplicateName.status, 409);

    const duplicateSymbol = await request(app)
      .post("/api/business/measurement-units")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, unitName: "Pieces", unitSymbol: "PC" });
    assert.equal(duplicateSymbol.status, 409);

    const list = await request(app)
      .get(`/api/business/measurement-units?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(list.status, 200);

    const update = await request(app)
      .put(`/api/business/measurement-units/${unitId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, unitName: "Pieces" });
    assert.equal(update.status, 200);

    const cross = await request(app)
      .get(`/api/business/measurement-units/${unitId}?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(cross.status, 403);
  });

  await suite.test("creates and updates one tax settings record", async () => {
    const create = await request(app)
      .post("/api/business/tax-invoice-settings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        taxEnabled: true,
        taxName: "GST",
        taxPercentage: 18,
        invoicePrefix: "inv",
      });
    assert.equal(create.status, 201);

    const update = await request(app)
      .post("/api/business/tax-invoice-settings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        taxEnabled: false,
        taxName: "VAT",
        taxPercentage: 5,
        invoicePrefix: "bill",
      });
    assert.equal(update.status, 200);

    assert.equal(
      await TaxInvoiceSettings.countDocuments({ businessId: ownerBusinessId }),
      1
    );

    const retrieve = await request(app)
      .get(`/api/business/tax-invoice-settings?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(retrieve.status, 200);
    assert.equal(retrieve.body.settings.invoicePrefix, "BILL");

    const invalid = await request(app)
      .post("/api/business/tax-invoice-settings")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        taxEnabled: true,
        taxPercentage: 101,
        invoicePrefix: "INV",
      });
    assert.equal(invalid.status, 400);
  });

  await suite.test("creates and updates one notification preference record", async () => {
    const create = await request(app)
      .post("/api/business/stock-notification-preferences")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        lowStockNotificationsEnabled: true,
        outOfStockNotificationsEnabled: false,
      });
    assert.equal(create.status, 201);

    const update = await request(app)
      .post("/api/business/stock-notification-preferences")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        lowStockNotificationsEnabled: false,
        outOfStockNotificationsEnabled: true,
      });
    assert.equal(update.status, 200);

    assert.equal(
      await StockNotificationPreference.countDocuments({
        businessId: ownerBusinessId,
      }),
      1
    );

    const retrieve = await request(app)
      .get(
        `/api/business/stock-notification-preferences?businessId=${ownerBusinessId}`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(retrieve.status, 200);
    assert.equal(retrieve.body.preferences.lowStockNotificationsEnabled, false);

    const invalid = await request(app)
      .post("/api/business/stock-notification-preferences")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        lowStockNotificationsEnabled: "yes",
        outOfStockNotificationsEnabled: true,
      });
    assert.equal(invalid.status, 400);
  });

  await suite.test("rejects insufficient-role mutations for category, warehouse and measurement unit APIs", async () => {
    const categoryCreate = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        categoryName: "Unauthorized Category",
      });
    assert.equal(categoryCreate.status, 403);

    const categoryUpdate = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        categoryName: "Unauthorized Category Update",
      });
    assert.equal(categoryUpdate.status, 403);

    const unauthorizedCategory = await Category.create({
      businessId: ownerBusinessId,
      categoryName: "Role Test Category",
    });
    const categoryDelete = await request(app)
      .delete(`/api/categories/${unauthorizedCategory._id}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(categoryDelete.status, 403);

    const warehouseCreate = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        warehouseName: "Unauthorized Warehouse",
        address: "Unauthorized",
        city: "Test City",
        contactNumber: "000",
      });
    assert.equal(warehouseCreate.status, 403);

    const warehouseUpdate = await request(app)
      .put(`/api/warehouses/${warehouseId}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        address: "Unauthorized Update",
      });
    assert.equal(warehouseUpdate.status, 403);

    const warehouseDelete = await request(app)
      .delete(`/api/warehouses/${warehouseId}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(warehouseDelete.status, 403);

    const unitCreate = await request(app)
      .post("/api/business/measurement-units")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        unitName: "Unauthorized Unit",
        unitSymbol: "uu",
      });
    assert.equal(unitCreate.status, 403);

    const unitUpdate = await request(app)
      .put(`/api/business/measurement-units/${unitId}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        unitName: "Unauthorized Unit Update",
      });
    assert.equal(unitUpdate.status, 403);

    const unitDelete = await request(app)
      .delete(`/api/business/measurement-units/${unitId}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(unitDelete.status, 403);
  });

  await suite.test("rejects insufficient-role tax and stock notification mutations", async () => {
    const taxUpdate = await request(app)
      .post("/api/business/tax-invoice-settings")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        taxEnabled: true,
        taxName: "Unauthorized Tax",
        taxPercentage: 20,
        invoicePrefix: "UNA",
      });
    assert.equal(taxUpdate.status, 403);

    const notificationUpdate = await request(app)
      .post("/api/business/stock-notification-preferences")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        lowStockNotificationsEnabled: true,
        outOfStockNotificationsEnabled: true,
      });
    assert.equal(notificationUpdate.status, 403);
  });

  await suite.test("allows warehouse owner deletion and rejects foreign warehouse deletion", async () => {
    const foreignWarehouse = await Warehouse.create({
      businessId: secondBusinessId,
      warehouseName: "Foreign Warehouse",
      address: "Foreign Address",
      city: "Foreign City",
      contactNumber: "999",
    });

    const foreignDelete = await request(app)
      .delete(`/api/warehouses/${foreignWarehouse._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: secondBusinessId });
    assert.equal(foreignDelete.status, 403);

    const ownerDelete = await request(app)
      .delete(`/api/warehouses/${warehouseId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(ownerDelete.status, 200);

    assert.equal(
      await Warehouse.exists({
        _id: warehouseId,
        businessId: ownerBusinessId,
      }),
      null
    );
  });

  await suite.test("allows measurement unit owner deletion and rejects foreign unit deletion", async () => {
    const foreignUnit = await MeasurementUnit.create({
      businessId: secondBusinessId,
      unitName: "Foreign Unit",
      unitSymbol: "fu",
    });

    const foreignDelete = await request(app)
      .delete(`/api/business/measurement-units/${foreignUnit._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: secondBusinessId });
    assert.equal(foreignDelete.status, 403);

    const ownerDelete = await request(app)
      .delete(`/api/business/measurement-units/${unitId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(ownerDelete.status, 200);

    assert.equal(
      await MeasurementUnit.exists({
        _id: unitId,
        businessId: ownerBusinessId,
      }),
      null
    );
  });

  await suite.test("preserves product creation and category isolation", async () => {
    const create = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productName: "Test Phone",
        sku: "PHONE-001",
        category: categoryId,
        purchasePrice: 100,
        sellingPrice: 150,
        currentStock: 0,
        minimumStockThreshold: 5,
      });
    assert.equal(create.status, 201);

    const foreignCategory = await Category.create({
      businessId: secondBusinessId,
      categoryName: "Foreign Category",
    });

    const crossCategory = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productName: "Cross Category",
        sku: "PHONE-002",
        category: foreignCategory._id.toString(),
        purchasePrice: 100,
        sellingPrice: 150,
      });
    assert.equal(crossCategory.status, 404);
  });

  await suite.test("prevents deletion of referenced categories", async () => {
    const deletion = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(deletion.status, 409);
  });

  await suite.test("runs Excel import and creates opening stock movement", async () => {
    const importSupplier = await Supplier.create({
      businessId: ownerBusinessId,
      supplierName: "Import Supplier",
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Products");

    sheet.columns = [
      { header: "productName", key: "productName" },
      { header: "sku", key: "sku" },
      { header: "category", key: "category" },
      { header: "purchasePrice", key: "purchasePrice" },
      { header: "sellingPrice", key: "sellingPrice" },
      { header: "openingStock", key: "openingStock" },
      { header: "minimumStockThreshold", key: "minimumStockThreshold" },
      { header: "supplier", key: "supplier" },
    ];

    sheet.addRow({
      productName: "Imported Item",
      sku: "IMPORT-001",
      category: categoryId,
      purchasePrice: 20,
      sellingPrice: 30,
      openingStock: 12,
      minimumStockThreshold: 3,
      supplier: importSupplier._id.toString(),
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const imported = await request(app)
      .post("/api/products/import")
      .set("Authorization", `Bearer ${ownerToken}`)
      .field("businessId", ownerBusinessId)
      .attach("file", buffer, "products.xlsx");
    assert.equal(imported.status, 200);
    assert.equal(imported.body.summary.imported, 1);

    const importedProduct = await Product.findOne({
      businessId: ownerBusinessId,
      sku: "IMPORT-001",
    }).lean();
    assert.equal(importedProduct?.currentStock, 12);
    assert.equal(importedProduct?.supplier?.toString(), importSupplier._id.toString());

    const movement = await InventoryMovement.findOne({
      businessId: ownerBusinessId,
      productId: importedProduct?._id,
      movementType: "OPENING_STOCK",
    }).lean();
    assert.equal(movement?.previousStock, 0);
    assert.equal(movement?.newStock, 12);
  });

  await suite.test("completes product CRUD, search, pagination and stock safeguards", async () => {
    const createProduct = async (productName: string, sku: string, supplier?: string) =>
      request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          businessId: ownerBusinessId,
          productName,
          sku,
          category: categoryId,
          purchasePrice: 40,
          sellingPrice: 60,
          ...(supplier ? { supplier } : {}),
        });

    const first = await createProduct("CRUD Product One", "CRUD-001");
    const second = await createProduct("CRUD Product Two", "CRUD-002");
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const productId = first.body.data._id as string;
    const secondProductId = second.body.data._id as string;

    const search = await request(app)
      .get(`/api/products?businessId=${ownerBusinessId}&search=CRUD&page=1&limit=1`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(search.status, 200);
    assert.equal(search.body.pagination.total, 2);
    assert.equal(search.body.pagination.totalPages, 2);
    assert.equal(search.body.products.length, 1);

    const secondPage = await request(app)
      .get(`/api/products?businessId=${ownerBusinessId}&search=CRUD&page=2&limit=1`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(secondPage.status, 200);
    assert.equal(secondPage.body.products.length, 1);
    assert.notEqual(search.body.products[0]._id, secondPage.body.products[0]._id);
    const categoryFilter = await request(app)
      .get(`/api/products?businessId=${ownerBusinessId}&categoryId=${categoryId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(categoryFilter.status, 200);
    assert.ok(
      categoryFilter.body.products.every(
        (product: { category: { _id: string } }) =>
          product.category._id.toString() === categoryId
      )
    );

    const details = await request(app)
      .get(`/api/products/${productId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(details.status, 200);
    assert.equal(details.body.product.sku, "CRUD-001");

    const update = await request(app)
      .put(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        sellingPrice: 75,
        minimumStockThreshold: 4,
      });
    assert.equal(update.status, 200);
    assert.equal(update.body.data.sellingPrice, 75);

    const duplicateSku = await createProduct("Duplicate", "CRUD-001");
    assert.equal(duplicateSku.status, 409);

    const stockUpdate = await request(app)
      .put(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, currentStock: 99 });
    assert.equal(stockUpdate.status, 400);
    assert.equal(
      (await Product.findById(productId).lean())?.currentStock,
      0
    );

    const accountantUpdate = await request(app)
      .put(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId, sellingPrice: 80 });
    assert.equal(accountantUpdate.status, 403);

    const foreignCategory = await Category.create({
      businessId: secondBusinessId,
      categoryName: "Product Isolation Category",
    });
    const foreignProduct = await Product.create({
      businessId: secondBusinessId,
      productName: "Foreign Product",
      sku: "FOREIGN-001",
      category: foreignCategory._id,
      purchasePrice: 10,
      sellingPrice: 20,
      currentStock: 0,
      minimumStockThreshold: 0,
    });
    const foreignDetails = await request(app)
      .get(`/api/products/${foreignProduct._id}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(foreignDetails.status, 404);
    const foreignUpdate = await request(app)
      .put(`/api/products/${foreignProduct._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, sellingPrice: 25 });
    assert.equal(foreignUpdate.status, 404);
    const foreignDelete = await request(app)
      .delete(`/api/products/${foreignProduct._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(foreignDelete.status, 404);
    const foreignWorkspace = await request(app)
      .get(`/api/products?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(foreignWorkspace.status, 403);

    const referencedProduct = await Product.findOne({
      businessId: ownerBusinessId,
      sku: "IMPORT-001",
    }).lean();
    const protectedDelete = await request(app)
      .delete(`/api/products/${referencedProduct?._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(protectedDelete.status, 409);

    const deleted = await request(app)
      .delete(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(deleted.status, 200);
    assert.equal(await Product.exists({ _id: productId }), null);

    const deletedSecond = await request(app)
      .delete(`/api/products/${secondProductId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(deletedSecond.status, 200);
  });

  await suite.test("records inventory movements atomically and prevents duplicate or negative stock", async () => {
    const createdProduct = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productName: "Inventory Ledger Product",
        sku: "INVENTORY-LEDGER-001",
        category: categoryId,
        purchasePrice: 12,
        sellingPrice: 20,
      });
    assert.equal(createdProduct.status, 201);
    const productId = createdProduct.body.data._id as string;
    const movementUrl = "/api/inventory/movements";

    const stockIn = await request(app)
      .post(movementUrl)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productId,
        movementType: "STOCK_IN",
        quantity: 10,
        referenceType: "manual",
        referenceId: "inventory-test-receipt",
      });
    assert.equal(stockIn.status, 201);
    assert.equal(stockIn.body.movement.previousStock, 0);
    assert.equal(stockIn.body.movement.newStock, 10);

    const duplicate = await request(app)
      .post(movementUrl)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productId,
        movementType: "STOCK_IN",
        quantity: 10,
        referenceType: "manual",
        referenceId: "inventory-test-receipt",
      });
    assert.equal(duplicate.status, 409);

    const insufficientStock = await request(app)
      .post(movementUrl)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productId,
        movementType: "STOCK_OUT",
        quantity: 11,
      });
    assert.equal(insufficientStock.status, 409);
    assert.equal((await Product.findById(productId).lean())?.currentStock, 10);

    const adjustment = await request(app)
      .post(movementUrl)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productId,
        movementType: "STOCK_ADJUSTMENT",
        newStock: 4,
      });
    assert.equal(adjustment.status, 201);
    assert.equal(adjustment.body.movement.quantity, 6);
    assert.equal(adjustment.body.movement.previousStock, 10);
    assert.equal(adjustment.body.movement.newStock, 4);
    assert.equal((await Product.findById(productId).lean())?.currentStock, 4);

    const movementHistory = await request(app)
      .get(`${movementUrl}?businessId=${ownerBusinessId}&productId=${productId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(movementHistory.status, 200);
    assert.equal(movementHistory.body.pagination.total, 2);

    const crossBusinessHistory = await request(app)
      .get(`${movementUrl}?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(crossBusinessHistory.status, 403);

    const accountantMutation = await request(app)
      .post(movementUrl)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        productId,
        movementType: "STOCK_IN",
        quantity: 1,
      });
    assert.equal(accountantMutation.status, 403);
  });

  await suite.test("receives purchases into warehouse stock and transfers stock idempotently", async () => {
    const supplier = await Supplier.create({
      businessId: ownerBusinessId,
      supplierName: "Receipt Workflow Supplier",
    });
    const productCreate = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productName: "Receipt Workflow Product",
        sku: "RECEIPT-WORKFLOW-001",
        category: categoryId,
        purchasePrice: 10,
        sellingPrice: 15,
        currentStock: 0,
        minimumStockThreshold: 2,
      });
    assert.equal(productCreate.status, 201);
    const product = await Product.findById(productCreate.body.data._id);
    assert.ok(product);
    const warehouse = await Warehouse.create({
      businessId: ownerBusinessId,
      warehouseName: "Receipt Workflow Warehouse",
      address: "100 Test Street",
      city: "Test City",
      contactNumber: "555-0100",
    });
    const destinationWarehouse = await Warehouse.create({
      businessId: ownerBusinessId,
      warehouseName: "Transfer Destination",
      address: "200 Test Street",
      city: "Test City",
      contactNumber: "555-0101",
    });

    const createdOrder = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        purchaseOrderNumber: "PO-RECEIPT-WORKFLOW-001",
        supplierId: supplier._id.toString(),
        products: [{ productId: product._id.toString(), quantity: 10 }],
      });
    assert.equal(createdOrder.status, 201);
    assert.equal(createdOrder.body.purchaseOrder.status, "DRAFT");
    assert.equal(createdOrder.body.purchaseOrder.subtotal, 100);
    const purchaseOrderId = createdOrder.body.purchaseOrder._id as string;

    const purchaseHistory = await request(app)
      .get(`/api/purchases?businessId=${ownerBusinessId}&search=PO-RECEIPT-WORKFLOW-001`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(purchaseHistory.status, 200);
    assert.equal(purchaseHistory.body.pagination.total, 1);
    assert.equal(
      purchaseHistory.body.purchaseOrders[0].purchaseOrderNumber,
      "PO-RECEIPT-WORKFLOW-001"
    );

    const warehouseList = await request(app)
      .get(`/api/warehouses?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(warehouseList.status, 200);
    assert.ok(
      warehouseList.body.warehouses.some(
        (item: { _id: string }) => item._id === warehouse._id.toString()
      )
    );

    const protectedProductDelete = await request(app)
      .delete(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(protectedProductDelete.status, 409);

    const protectedSupplierDelete = await request(app)
      .delete(`/api/suppliers/${supplier._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(protectedSupplierDelete.status, 409);

    const editOrder = await request(app)
      .put(`/api/purchases/${purchaseOrderId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        purchaseOrderNumber: "PO-RECEIPT-WORKFLOW-001",
        supplierId: supplier._id.toString(),
        products: [{ productId: product._id.toString(), quantity: 10 }],
      });
    assert.equal(editOrder.status, 200);

    const approved = await request(app)
      .post(`/api/purchases/${purchaseOrderId}/approve`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.purchaseOrder.status, "APPROVED");

    const receive = (key: string, receivedQuantity: number, damagedQuantity: number) =>
      request(app)
        .post(`/api/purchases/${purchaseOrderId}/receive`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .set("Idempotency-Key", key)
        .send({
          businessId: ownerBusinessId,
          warehouseId: warehouse._id.toString(),
          products: [
            {
              productId: product._id.toString(),
              receivedQuantity,
              damagedQuantity,
            },
          ],
        });

    const firstReceipt = await receive(
      "receipt-workflow-first",
      6,
      1
    );
    assert.equal(firstReceipt.status, 201);
    assert.equal(firstReceipt.body.purchaseOrder.status, "PARTIALLY_RECEIVED");
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 5);
    assert.equal(
      await StockAlert.countDocuments({
        businessId: ownerBusinessId,
        productId: product._id,
        condition: "OUT_OF_STOCK",
        status: "RESOLVED",
      }),
      1
    );
    assert.equal(
      (await InventoryBalance.findOne({
        businessId: ownerBusinessId,
        productId: product._id,
        warehouseId: warehouse._id,
      }).lean())?.availableQuantity,
      5
    );
    const balanceList = await request(app)
      .get(
        `/api/inventory/balances?businessId=${ownerBusinessId}&warehouseId=${warehouse._id}`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(balanceList.status, 200);
    assert.equal(balanceList.body.balances.length, 1);
    assert.equal(balanceList.body.balances[0].availableQuantity, 5);

    const firstReceiptHistory = await request(app)
      .get(`/api/purchases/${purchaseOrderId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(firstReceiptHistory.status, 200);
    assert.equal(firstReceiptHistory.body.receipts.length, 1);

    const duplicateReceipt = await receive(
      "receipt-workflow-first",
      6,
      1
    );
    assert.equal(duplicateReceipt.status, 409);
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 5);
    assert.equal(await GoodsReceipt.countDocuments({ purchaseOrderId }), 1);

    const finalReceipt = await receive("receipt-workflow-final", 4, 0);
    assert.equal(finalReceipt.status, 201);
    assert.equal(finalReceipt.body.purchaseOrder.status, "RECEIVED");
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 9);
    const receiptMovements = await request(app)
      .get(
        `/api/inventory/movements?businessId=${ownerBusinessId}&warehouseId=${warehouse._id}&movementType=PURCHASE_RECEIPT`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(receiptMovements.status, 200);
    assert.equal(receiptMovements.body.pagination.total, 2);

    const crossBusinessBalances = await request(app)
      .get(`/api/inventory/balances?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(crossBusinessBalances.status, 403);

    const transfer = await request(app)
      .post("/api/inventory/transfers")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("Idempotency-Key", "receipt-workflow-transfer")
      .send({
        businessId: ownerBusinessId,
        productId: product._id.toString(),
        sourceWarehouseId: warehouse._id.toString(),
        destinationWarehouseId: destinationWarehouse._id.toString(),
        quantity: 4,
      });
    assert.equal(transfer.status, 201);
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 9);

    const duplicateTransfer = await request(app)
      .post("/api/inventory/transfers")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("Idempotency-Key", "receipt-workflow-transfer")
      .send({
        businessId: ownerBusinessId,
        productId: product._id.toString(),
        sourceWarehouseId: warehouse._id.toString(),
        destinationWarehouseId: destinationWarehouse._id.toString(),
        quantity: 4,
      });
    assert.equal(duplicateTransfer.status, 409);

    const insufficientTransfer = await request(app)
      .post("/api/inventory/transfers")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("Idempotency-Key", "receipt-workflow-insufficient")
      .send({
        businessId: ownerBusinessId,
        productId: product._id.toString(),
        sourceWarehouseId: warehouse._id.toString(),
        destinationWarehouseId: destinationWarehouse._id.toString(),
        quantity: 6,
      });
    assert.equal(insufficientTransfer.status, 409);

    const sourceBalance = await InventoryBalance.findOne({
      businessId: ownerBusinessId,
      productId: product._id,
      warehouseId: warehouse._id,
    }).lean();
    const destinationBalance = await InventoryBalance.findOne({
      businessId: ownerBusinessId,
      productId: product._id,
      warehouseId: destinationWarehouse._id,
    }).lean();
    assert.equal(sourceBalance?.availableQuantity, 5);
    assert.equal(destinationBalance?.availableQuantity, 4);
    assert.equal(await InventoryTransfer.countDocuments({ businessId: ownerBusinessId }), 1);

    const transferHistory = await request(app)
      .get(`/api/inventory/transfers?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(transferHistory.status, 200);
    assert.equal(transferHistory.body.pagination.total, 1);

    const transferMovements = await request(app)
      .get(
        `/api/inventory/movements?businessId=${ownerBusinessId}&movementType=STOCK_TRANSFER`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(transferMovements.status, 200);
    assert.equal(transferMovements.body.pagination.total, 2);

    const protectedWarehouseDelete = await request(app)
      .delete(`/api/warehouses/${warehouse._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(protectedWarehouseDelete.status, 409);

    const accountantTransfer = await request(app)
      .post("/api/inventory/transfers")
      .set("Authorization", `Bearer ${secondToken}`)
      .set("Idempotency-Key", "receipt-workflow-accountant")
      .send({
        businessId: ownerBusinessId,
        productId: product._id.toString(),
        sourceWarehouseId: warehouse._id.toString(),
        destinationWarehouseId: destinationWarehouse._id.toString(),
        quantity: 1,
      });
    assert.equal(accountantTransfer.status, 403);

    const foreignPurchaseList = await request(app)
      .get(`/api/purchases?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(foreignPurchaseList.status, 403);

    const accountantPurchase = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        purchaseOrderNumber: "PO-ACCOUNTANT-001",
        supplierId: supplier._id.toString(),
        products: [{ productId: product._id.toString(), quantity: 1 }],
      });
    assert.equal(accountantPurchase.status, 403);
  });

  await suite.test("creates sales, deducts warehouse stock once, and restores stock safely", async () => {
    const product = await Product.findOne({
      businessId: ownerBusinessId,
      sku: "RECEIPT-WORKFLOW-001",
    }).lean();
    const warehouse = await Warehouse.findOne({
      businessId: ownerBusinessId,
      warehouseName: "Receipt Workflow Warehouse",
    }).lean();
    assert.ok(product);
    assert.ok(warehouse);
    const thresholdUpdate = await request(app)
      .put(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        minimumStockThreshold: 10,
      });
    assert.equal(thresholdUpdate.status, 200);
    const assertStockAlertSnapshot = async () => {
      const currentProduct = await Product.findById(product._id).lean();
      const activeAlert = await StockAlert.findOne({
        businessId: ownerBusinessId,
        productId: product._id,
        condition: "LOW_STOCK",
        status: "ACTIVE",
      }).lean();
      assert.equal(activeAlert?.currentStock, currentProduct?.currentStock);
    };

    const customer = await Customer.create({
      businessId: ownerBusinessId,
      customerName: "Sales Workflow Client",
      email: "sales-workflow@buyers.test",
    });
    const foreignCustomer = await Customer.create({
      businessId: secondBusinessId,
      customerName: "Foreign Sales Customer",
      email: "foreign-sales@customer.test",
    });
    const foreignProduct = await Product.create({
      businessId: secondBusinessId,
      productName: "Foreign Sales Product",
      sku: "FOREIGN-SALES-001",
      category: categoryId,
      purchasePrice: 1,
      sellingPrice: 3,
      currentStock: 1,
      minimumStockThreshold: 0,
    });
    const foreignWarehouse = await Warehouse.create({
      businessId: secondBusinessId,
      warehouseName: "Foreign Sales Warehouse",
      address: "Foreign Street",
      city: "Test City",
      contactNumber: "555-0199",
    });
    const taxSettingsBefore = await TaxInvoiceSettings.findOne({
      businessId: ownerBusinessId,
    }).lean();
    await TaxInvoiceSettings.findOneAndUpdate(
      { businessId: ownerBusinessId },
      { $set: { taxEnabled: true, taxPercentage: 10 } }
    );

    const saleBody = {
      businessId: ownerBusinessId,
      customerId: customer._id.toString(),
      warehouseId: warehouse._id.toString(),
      products: [
        {
          productId: product._id.toString(),
          quantity: 2,
          discountPercentage: 10,
        },
      ],
    };
    const invalidDuplicateProducts = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        ...saleBody,
        products: [
          ...saleBody.products,
          { ...saleBody.products[0], quantity: 1 },
        ],
      });
    assert.equal(invalidDuplicateProducts.status, 400);

    const foreignCustomerSale = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ ...saleBody, customerId: foreignCustomer._id.toString() });
    assert.equal(foreignCustomerSale.status, 404);
    const foreignProductSale = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        ...saleBody,
        products: [
          { productId: foreignProduct._id.toString(), quantity: 1 },
        ],
      });
    assert.equal(foreignProductSale.status, 404);
    const foreignWarehouseSale = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ ...saleBody, warehouseId: foreignWarehouse._id.toString() });
    assert.equal(foreignWarehouseSale.status, 404);

    const created = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(saleBody);
    assert.equal(created.status, 201);
    assert.equal(created.body.salesOrder.status, "DRAFT");
    assert.match(created.body.salesOrder.salesOrderNumber, /^SO-/);
    assert.equal(created.body.salesOrder.subtotal, 30);
    assert.equal(created.body.salesOrder.discountTotal, 3);
    assert.equal(created.body.salesOrder.tax, 2.7);
    assert.equal(created.body.salesOrder.totalAmount, 29.7);
    const salesOrderId = created.body.salesOrder._id as string;

    const edited = await request(app)
      .put(`/api/sales/${salesOrderId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        ...saleBody,
        products: [
          {
            productId: product._id.toString(),
            quantity: 3,
            discountPercentage: 10,
          },
        ],
      });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.salesOrder.subtotal, 45);
    assert.equal(edited.body.salesOrder.totalAmount, 44.55);

    const searchableOrders = await request(app)
      .get(
        `/api/sales?businessId=${ownerBusinessId}&search=${edited.body.salesOrder.salesOrderNumber}&status=DRAFT&limit=1`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(searchableOrders.status, 200);
    assert.equal(searchableOrders.body.pagination.total, 1);
    assert.equal(searchableOrders.body.salesOrders[0]._id, salesOrderId);

    const details = await request(app)
      .get(`/api/sales/${salesOrderId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(details.status, 200);
    assert.equal(details.body.salesOrder.customerName, customer.customerName);
    const crossBusinessDetails = await request(app)
      .get(`/api/sales/${salesOrderId}?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(crossBusinessDetails.status, 403);
    const protectedCustomerDelete = await request(app)
      .delete(`/api/customers/${customer._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(protectedCustomerDelete.status, 409);

    const completed = await request(app)
      .post(`/api/sales/${salesOrderId}/complete`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.salesOrder.status, "COMPLETED");
    await assertStockAlertSnapshot();
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 6);
    assert.equal(
      (
        await InventoryBalance.findOne({
          businessId: ownerBusinessId,
          productId: product._id,
          warehouseId: warehouse._id,
        }).lean()
      )?.availableQuantity,
      2
    );
    const duplicateComplete = await request(app)
      .post(`/api/sales/${salesOrderId}/complete`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(duplicateComplete.status, 409);
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 6);
    assert.equal(
      await InventoryMovement.countDocuments({
        businessId: ownerBusinessId,
        referenceType: "SALES_ORDER",
        referenceId: salesOrderId,
      }),
      1
    );

    const returnSale = (key: string, quantity: number) =>
      request(app)
        .post(`/api/sales/${salesOrderId}/returns`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .set("Idempotency-Key", key)
        .send({
          businessId: ownerBusinessId,
          products: [{ productId: product._id.toString(), quantity }],
        });
    const missingReturnKey = await request(app)
      .post(`/api/sales/${salesOrderId}/returns`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        products: [{ productId: product._id.toString(), quantity: 1 }],
      });
    assert.equal(missingReturnKey.status, 400);

    const firstReturn = await returnSale("sales-return-first", 1);
    assert.equal(firstReturn.status, 201);
    assert.equal(firstReturn.body.salesOrder.status, "PARTIALLY_RETURNED");
    await assertStockAlertSnapshot();
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 7);
    assert.equal(
      (
        await InventoryBalance.findOne({
          businessId: ownerBusinessId,
          productId: product._id,
          warehouseId: warehouse._id,
        }).lean()
      )?.availableQuantity,
      3
    );
    const duplicateReturn = await returnSale("sales-return-first", 1);
    assert.equal(duplicateReturn.status, 409);
    assert.equal(await SalesReturn.countDocuments({ salesOrderId }), 1);
    const excessiveReturn = await returnSale("sales-return-excess", 3);
    assert.equal(excessiveReturn.status, 400);
    const cancelAfterReturn = await request(app)
      .post(`/api/sales/${salesOrderId}/cancel`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(cancelAfterReturn.status, 409);
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 7);

    const finalReturn = await returnSale("sales-return-final", 2);
    assert.equal(finalReturn.status, 201);
    assert.equal(finalReturn.body.salesOrder.status, "RETURNED");
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 9);
    const saleHistory = await request(app)
      .get(`/api/sales/${salesOrderId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(saleHistory.status, 200);
    assert.equal(saleHistory.body.returns.length, 2);

    const cancellationSale = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        ...saleBody,
        products: [{ productId: product._id.toString(), quantity: 1 }],
      });
    assert.equal(cancellationSale.status, 201);
    const cancellationId = cancellationSale.body.salesOrder._id as string;
    const cancellationComplete = await request(app)
      .post(`/api/sales/${cancellationId}/complete`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(cancellationComplete.status, 200);
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 8);
    assert.equal(
      (
        await InventoryBalance.findOne({
          businessId: ownerBusinessId,
          productId: product._id,
          warehouseId: warehouse._id,
        }).lean()
      )?.availableQuantity,
      4
    );
    const cancelled = await request(app)
      .post(`/api/sales/${cancellationId}/cancel`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.salesOrder.status, "CANCELLED");
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 9);
    assert.equal(
      (
        await InventoryBalance.findOne({
          businessId: ownerBusinessId,
          productId: product._id,
          warehouseId: warehouse._id,
        }).lean()
      )?.availableQuantity,
      5
    );
    const duplicateCancel = await request(app)
      .post(`/api/sales/${cancellationId}/cancel`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(duplicateCancel.status, 409);
    assert.equal(
      await InventoryMovement.countDocuments({
        businessId: ownerBusinessId,
        referenceType: "SALES_CANCELLATION",
        referenceId: cancellationId,
      }),
      1
    );

    const insufficientSale = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        ...saleBody,
        products: [{ productId: product._id.toString(), quantity: 6 }],
      });
    assert.equal(insufficientSale.status, 201);
    const insufficientId = insufficientSale.body.salesOrder._id as string;
    const insufficientComplete = await request(app)
      .post(`/api/sales/${insufficientId}/complete`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(insufficientComplete.status, 409);
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 9);
    assert.equal(
      (
        await InventoryBalance.findOne({
          businessId: ownerBusinessId,
          productId: product._id,
          warehouseId: warehouse._id,
        }).lean()
      )?.availableQuantity,
      5
    );
    assert.equal(
      (await SalesOrder.findById(insufficientId).lean())?.status,
      "DRAFT"
    );

    const accountantCreate = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${secondToken}`)
      .send(saleBody);
    assert.equal(accountantCreate.status, 403);
    const accountantComplete = await request(app)
      .post(`/api/sales/${insufficientId}/complete`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(accountantComplete.status, 403);
    const crossBusinessList = await request(app)
      .get(`/api/sales?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(crossBusinessList.status, 403);

    await Membership.findOneAndUpdate(
      { userId: secondId, businessId: ownerBusinessId },
      { $set: { role: "SALES_EMPLOYEE" } }
    );
    const employeeSale = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        ...saleBody,
        products: [{ productId: product._id.toString(), quantity: 1 }],
      });
    assert.equal(employeeSale.status, 201);
    const employeeSaleId = employeeSale.body.salesOrder._id as string;
    const employeeComplete = await request(app)
      .post(`/api/sales/${employeeSaleId}/complete`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(employeeComplete.status, 200);
    await Membership.findOneAndUpdate(
      { userId: secondId, businessId: ownerBusinessId },
      { $set: { role: "ACCOUNTANT" } }
    );
    assert.equal((await Product.findById(product._id).lean())?.currentStock, 8);
    assert.equal(
      (
        await InventoryBalance.findOne({
          businessId: ownerBusinessId,
          productId: product._id,
          warehouseId: warehouse._id,
        }).lean()
      )?.availableQuantity,
      4
    );
    const completedFilter = await request(app)
      .get(`/api/sales?businessId=${ownerBusinessId}&status=COMPLETED&limit=1`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(completedFilter.status, 200);
    assert.equal(completedFilter.body.pagination.total, 1);
    assert.equal(completedFilter.body.pagination.limit, 1);

    if (taxSettingsBefore) {
      await TaxInvoiceSettings.findOneAndUpdate(
        { businessId: ownerBusinessId },
        {
          $set: {
            taxEnabled: taxSettingsBefore.taxEnabled,
            taxName: taxSettingsBefore.taxName,
            taxPercentage: taxSettingsBefore.taxPercentage,
            invoicePrefix: taxSettingsBefore.invoicePrefix,
          },
        }
      );
    }
  });

  await suite.test("generates unique invoices and records payments with PDF downloads", async () => {
    const customer = await Customer.findOne({
      businessId: ownerBusinessId,
      email: "sales-workflow@buyers.test",
    }).lean();
    const product = await Product.findOne({
      businessId: ownerBusinessId,
      sku: "RECEIPT-WORKFLOW-001",
    }).lean();
    const warehouse = await Warehouse.findOne({
      businessId: ownerBusinessId,
      warehouseName: "Receipt Workflow Warehouse",
    }).lean();
    assert.ok(customer);
    assert.ok(product);
    assert.ok(warehouse);

    const priorSettings = await TaxInvoiceSettings.findOne({
      businessId: ownerBusinessId,
    }).lean();
    await TaxInvoiceSettings.findOneAndUpdate(
      { businessId: ownerBusinessId },
      {
        $set: {
          taxEnabled: true,
          taxName: "GST",
          taxPercentage: 10,
          invoicePrefix: "TST",
        },
      }
    );

    const sale = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        customerId: customer._id.toString(),
        warehouseId: warehouse._id.toString(),
        products: [
          {
            productId: product._id.toString(),
            quantity: 2,
            discountPercentage: 5,
          },
        ],
      });
    assert.equal(sale.status, 201);
    const salesOrderId = sale.body.salesOrder._id as string;
    const completed = await request(app)
      .post(`/api/sales/${salesOrderId}/complete`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(completed.status, 200);

    const draftOrder = await SalesOrder.findOne({
      businessId: ownerBusinessId,
      status: "DRAFT",
    }).lean();
    assert.ok(draftOrder);
    const draftInvoice = await request(app)
      .post(`/api/invoices/from-sales/${draftOrder._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(draftInvoice.status, 409);

    const generated = await request(app)
      .post(`/api/invoices/from-sales/${salesOrderId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(generated.status, 201);
    const invoice = generated.body.invoice;
    const invoiceId = invoice._id as string;
    assert.match(invoice.invoiceNumber, /^TST-\d{4}-000001$/);
    assert.equal(invoice.salesOrderId, salesOrderId);
    assert.equal(invoice.customerName, customer.customerName);
    assert.equal(invoice.products[0].quantity, 2);
    assert.equal(invoice.products[0].unitPrice, 15);
    assert.equal(invoice.products[0].discountAmount, 1.5);
    assert.equal(invoice.products[0].taxAmount, 2.85);
    assert.equal(invoice.products[0].lineTotal, 31.35);
    assert.equal(invoice.subtotal, 30);
    assert.equal(invoice.discountTotal, 1.5);
    assert.equal(invoice.taxName, "GST");
    assert.equal(invoice.tax, 2.85);
    assert.equal(invoice.totalAmount, 31.35);
    assert.equal(invoice.balanceDue, 31.35);
    assert.equal(invoice.paymentStatus, "UNPAID");

    await Product.updateOne(
      { _id: product._id, businessId: ownerBusinessId },
      { $set: { sellingPrice: 99 } }
    );
    const duplicateInvoice = await request(app)
      .post(`/api/invoices/from-sales/${salesOrderId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(duplicateInvoice.status, 409);
    assert.equal(await Invoice.countDocuments({ businessId: ownerBusinessId }), 1);
    assert.equal(
      (await SalesOrder.findById(salesOrderId).lean())?.invoiceId?.toString(),
      invoiceId
    );
    const salesInvoice = await request(app)
      .get(`/api/invoices/by-sales-order/${salesOrderId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(salesInvoice.status, 200);
    assert.equal(salesInvoice.body.invoice._id, invoiceId);

    const invoiceList = await request(app)
      .get(
        `/api/invoices?businessId=${ownerBusinessId}&search=${invoice.invoiceNumber}&status=UNPAID&from=${new Date().toISOString().slice(0, 10)}`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(invoiceList.status, 200);
    assert.equal(invoiceList.body.pagination.total, 1);
    assert.equal(invoiceList.body.invoices[0].invoiceNumber, invoice.invoiceNumber);
    const invalidInvoiceDate = await request(app)
      .get(`/api/invoices?businessId=${ownerBusinessId}&from=not-a-date`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(invalidInvoiceDate.status, 400);

    const invoiceDetails = await request(app)
      .get(`/api/invoices/${invoiceId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(invoiceDetails.status, 200);
    assert.equal(invoiceDetails.body.payments.length, 0);
    const foreignInvoiceDetails = await request(app)
      .get(`/api/invoices/${invoiceId}?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${secondToken}`);
    assert.equal(foreignInvoiceDetails.status, 404);
    const crossBusinessList = await request(app)
      .get(`/api/invoices?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(crossBusinessList.status, 403);
    const accountantGenerate = await request(app)
      .post(`/api/invoices/from-sales/${salesOrderId}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(accountantGenerate.status, 403);

    const pdf = await request(app)
      .get(`/api/invoices/${invoiceId}/pdf?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers["content-type"], /application\/pdf/);
    assert.ok(Buffer.isBuffer(pdf.body));
    assert.equal(pdf.body.subarray(0, 5).toString(), "%PDF-");

    const partialPayment = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${secondToken}`)
      .set("Idempotency-Key", "invoice-payment-partial")
      .send({
        businessId: ownerBusinessId,
        amount: 10,
        paymentMethod: "CASH",
        reference: "CASH-RECEIPT-001",
      });
    assert.equal(partialPayment.status, 201);
    assert.equal(partialPayment.body.invoice.amountPaid, 10);
    assert.equal(partialPayment.body.invoice.balanceDue, 21.35);
    assert.equal(partialPayment.body.invoice.paymentStatus, "PARTIALLY_PAID");

    const duplicatePayment = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${secondToken}`)
      .set("Idempotency-Key", "invoice-payment-partial")
      .send({
        businessId: ownerBusinessId,
        amount: 10,
        paymentMethod: "CASH",
        reference: "CASH-RECEIPT-001",
      });
    assert.equal(duplicatePayment.status, 409);
    const duplicateReference = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${secondToken}`)
      .set("Idempotency-Key", "invoice-payment-duplicate-reference")
      .send({
        businessId: ownerBusinessId,
        amount: 1,
        paymentMethod: "CASH",
        reference: "CASH-RECEIPT-001",
      });
    assert.equal(duplicateReference.status, 409);
    const overpayment = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("Idempotency-Key", "invoice-payment-overpay")
      .send({
        businessId: ownerBusinessId,
        amount: 21.36,
        paymentMethod: "BANK_TRANSFER",
      });
    assert.equal(overpayment.status, 409);

    const fullPayment = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("Idempotency-Key", "invoice-payment-final")
      .send({
        businessId: ownerBusinessId,
        amount: 21.35,
        paymentMethod: "BANK_TRANSFER",
        reference: "BANK-RECEIPT-001",
      });
    assert.equal(fullPayment.status, 201);
    assert.equal(fullPayment.body.invoice.amountPaid, 31.35);
    assert.equal(fullPayment.body.invoice.balanceDue, 0);
    assert.equal(fullPayment.body.invoice.paymentStatus, "PAID");
    assert.ok(fullPayment.body.invoice.paidAt);
    const paidInvoice = await request(app)
      .get(`/api/invoices/${invoiceId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(paidInvoice.status, 200);
    assert.equal(paidInvoice.body.payments.length, 2);
    assert.equal(
      (await InvoicePayment.countDocuments({ businessId: ownerBusinessId, invoiceId })),
      2
    );

    const remainingSale = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        customerId: customer._id.toString(),
        warehouseId: warehouse._id.toString(),
        products: [{ productId: product._id.toString(), quantity: 1 }],
      });
    assert.equal(remainingSale.status, 201);
    const remainingSaleId = remainingSale.body.salesOrder._id as string;
    const remainingSaleCompleted = await request(app)
      .post(`/api/sales/${remainingSaleId}/complete`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(remainingSaleCompleted.status, 200);
    const secondInvoice = await request(app)
      .post(`/api/invoices/from-sales/${remainingSaleId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(secondInvoice.status, 201);
    assert.match(secondInvoice.body.invoice.invoiceNumber, /^TST-\d{4}-000002$/);
    assert.equal(secondInvoice.body.invoice.products[0].unitPrice, 99);
    const unpaidFilter = await request(app)
      .get(`/api/invoices?businessId=${ownerBusinessId}&status=UNPAID`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(unpaidFilter.status, 200);
    assert.equal(unpaidFilter.body.pagination.total, 1);

    if (priorSettings) {
      await TaxInvoiceSettings.findOneAndUpdate(
        { businessId: ownerBusinessId },
        {
          $set: {
            taxEnabled: priorSettings.taxEnabled,
            taxName: priorSettings.taxName,
            taxPercentage: priorSettings.taxPercentage,
            invoicePrefix: priorSettings.invoicePrefix,
          },
        }
      );
    }
  });

  await suite.test("tracks stock alerts, preference-scoped notifications and immutable audit history", async () => {
    const alertEmployee = await User.create({
      name: "Stock Alert Employee",
      email: "stock-alert-employee@stockpilot.test",
      password: "UnusedEmployeePassword123!",
      role: "BUSINESS_OWNER",
    });
    const alertEmployeeId = alertEmployee._id.toString();
    const alertEmployeeToken = jwt.sign(
      { userId: alertEmployeeId, role: "BUSINESS_OWNER" },
      process.env.JWT_SECRET!
    );
    await Membership.create({
      userId: alertEmployeeId,
      businessId: ownerBusinessId,
      role: "SALES_EMPLOYEE",
    });
    const preferenceUpdate = await request(app)
      .post("/api/business/stock-notification-preferences")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        lowStockNotificationsEnabled: true,
        outOfStockNotificationsEnabled: true,
      });
    assert.equal(preferenceUpdate.status, 200);

    const createdProduct = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productName: "Alert Workflow Product",
        sku: "ALERT-WORKFLOW-001",
        category: categoryId,
        purchasePrice: 12,
        sellingPrice: 20,
        minimumStockThreshold: 2,
      });
    assert.equal(createdProduct.status, 201);
    const productId = createdProduct.body.data._id as string;
    const movement = async (
      movementType: "STOCK_IN" | "STOCK_OUT",
      quantity: number,
      referenceId: string
    ) =>
      request(app)
        .post("/api/inventory/movements")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          businessId: ownerBusinessId,
          productId,
          movementType,
          quantity,
          referenceType: "stock-alert-test",
          referenceId,
        });

    const initialOutAlert = await StockAlert.findOne({
      businessId: ownerBusinessId,
      productId,
      condition: "OUT_OF_STOCK",
      status: "ACTIVE",
    }).lean();
    assert.ok(initialOutAlert);

    const firstReceipt = await movement("STOCK_IN", 1, "alert-first-in");
    assert.equal(firstReceipt.status, 201);
    const lowAlert = await StockAlert.findOne({
      businessId: ownerBusinessId,
      productId,
      condition: "LOW_STOCK",
      status: "ACTIVE",
    }).lean();
    assert.equal(lowAlert?.currentStock, 1);
    assert.equal(
      await StockAlert.countDocuments({
        businessId: ownerBusinessId,
        productId,
        condition: "OUT_OF_STOCK",
        status: "ACTIVE",
      }),
      0
    );

    const secondReceipt = await movement("STOCK_IN", 2, "alert-second-in");
    assert.equal(secondReceipt.status, 201);
    assert.equal(
      await StockAlert.countDocuments({
        businessId: ownerBusinessId,
        productId,
        condition: "LOW_STOCK",
        status: "ACTIVE",
      }),
      0
    );
    const repeatedReceipt = await movement("STOCK_IN", 2, "alert-second-in");
    assert.equal(repeatedReceipt.status, 409);

    const depletion = await movement("STOCK_OUT", 3, "alert-stock-out");
    assert.equal(depletion.status, 201);
    assert.equal(
      await StockAlert.countDocuments({
        businessId: ownerBusinessId,
        productId,
        condition: "OUT_OF_STOCK",
        status: "ACTIVE",
      }),
      1
    );
    assert.equal(
      await InAppNotification.countDocuments({
        businessId: ownerBusinessId,
        productId,
        recipientUserId: ownerId,
      }),
      5
    );
    assert.equal(
      await InAppNotification.countDocuments({
        businessId: ownerBusinessId,
        productId,
        recipientUserId: alertEmployeeId,
      }),
      5
    );

    const activeAlerts = await request(app)
      .get(
        `/api/inventory/alerts?businessId=${ownerBusinessId}&condition=OUT_OF_STOCK&search=Alert%20Workflow`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(activeAlerts.status, 200);
    assert.equal(activeAlerts.body.alerts.length, 1);
    assert.equal(activeAlerts.body.alerts[0].productId.currentStock, 0);

    const resolvedAlerts = await request(app)
      .get(
        `/api/inventory/alerts?businessId=${ownerBusinessId}&status=RESOLVED`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(resolvedAlerts.status, 200);
    assert.ok(resolvedAlerts.body.alerts.length >= 2);

    const foreignAlerts = await request(app)
      .get(`/api/inventory/alerts?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(foreignAlerts.status, 403);

    const ownerNotifications = await request(app)
      .get(
        `/api/notifications?businessId=${ownerBusinessId}&category=STOCK_ALERT&unreadOnly=true`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(ownerNotifications.status, 200);
    assert.ok(ownerNotifications.body.unreadCount >= 5);
    const alertNotification = ownerNotifications.body.notifications.find(
      (item: { productId?: { _id: string } | null }) =>
        item.productId?._id === productId
    );
    assert.ok(alertNotification);
    const notificationId = alertNotification._id as string;
    const foreignRead = await request(app)
      .post(`/api/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${alertEmployeeToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(foreignRead.status, 404);
    const markRead = await request(app)
      .post(`/api/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(markRead.status, 200);
    assert.ok(markRead.body.notification.readAt);

    const auditListing = await request(app)
      .get(
        `/api/audit-logs?businessId=${ownerBusinessId}&resourceType=INVENTORY_MOVEMENT&action=INVENTORY_STOCK_IN&resourceId=${firstReceipt.body.movement._id}`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(auditListing.status, 200);
    assert.equal(auditListing.body.auditLogs.length, 1);
    assert.equal(auditListing.body.auditLogs[0].actorUserId._id, ownerId);
    const secondAudit = await request(app)
      .get(
        `/api/audit-logs?businessId=${ownerBusinessId}&resourceType=INVENTORY_MOVEMENT&resourceId=${secondReceipt.body.movement._id}`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(secondAudit.status, 200);
    assert.equal(secondAudit.body.auditLogs.length, 1);
    assert.equal(
      await AuditLog.countDocuments({
        businessId: ownerBusinessId,
        action: "INVENTORY_STOCK_OUT",
      }),
      1
    );

    const restrictedAudit = await request(app)
      .get(`/api/audit-logs?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${alertEmployeeToken}`);
    assert.equal(restrictedAudit.status, 403);
    const foreignAudit = await request(app)
      .get(`/api/audit-logs?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(foreignAudit.status, 403);
    const auditMutation = await request(app)
      .delete(`/api/audit-logs/${auditListing.body.auditLogs[0]._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(auditMutation.status, 404);

    const preferenceDisable = await request(app)
      .post("/api/business/stock-notification-preferences")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        lowStockNotificationsEnabled: true,
        outOfStockNotificationsEnabled: false,
      });
    assert.equal(preferenceDisable.status, 200);
    const disabledProduct = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productName: "Disabled Alert Notification Product",
        sku: "ALERT-DISABLED-001",
        category: categoryId,
        purchasePrice: 12,
        sellingPrice: 20,
        minimumStockThreshold: 0,
      });
    assert.equal(disabledProduct.status, 201);
    assert.equal(
      await StockAlert.countDocuments({
        businessId: ownerBusinessId,
        productId: disabledProduct.body.data._id,
        condition: "OUT_OF_STOCK",
        status: "ACTIVE",
      }),
      1
    );
    assert.equal(
      await InAppNotification.countDocuments({
        businessId: ownerBusinessId,
        productId: disabledProduct.body.data._id,
      }),
      0
    );

    for (const action of [
      "PURCHASE_RECEIVED",
      "SALES_COMPLETED",
      "SALES_RETURNED",
      "INVOICE_CREATED",
      "INVOICE_PAYMENT_RECORDED",
    ]) {
      assert.ok(
        (await AuditLog.countDocuments({ businessId: ownerBusinessId, action })) > 0,
        `Expected audit history for ${action}.`
      );
    }
  });

  await suite.test("reports workspace-scoped analytics and exports accurate filtered data", async () => {
    const analyticsDate = new Date("2026-01-15T12:00:00.000Z");
    const saleDate = new Date("2026-01-20T12:00:00.000Z");
    const missingCostDate = new Date("2026-01-21T12:00:00.000Z");
    const supplier = await Supplier.create({
      businessId: ownerBusinessId,
      supplierName: "Analytics Supplier",
    });
    const customer = await Customer.create({
      businessId: ownerBusinessId,
      customerName: "Analytics Customer",
    });
    const warehouse = await Warehouse.create({
      businessId: ownerBusinessId,
      warehouseName: "Analytics Warehouse",
      address: "10 Analytics Road",
      city: "Test City",
      contactNumber: "123456789",
    });
    const product = await Product.create({
      businessId: ownerBusinessId,
      productName: "Analytics Product",
      sku: "ANALYTICS-001",
      category: categoryId,
      purchasePrice: 5,
      sellingPrice: 10,
      currentStock: 8,
      minimumStockThreshold: 3,
    });
    const purchaseOrder = await PurchaseOrder.create({
      businessId: ownerBusinessId,
      purchaseOrderNumber: "PO-ANALYTICS-001",
      supplierId: supplier._id,
      products: [
        {
          productId: product._id,
          productName: product.productName,
          sku: product.sku,
          quantity: 5,
          unitPrice: 4,
          receivedQuantity: 5,
        },
      ],
      subtotal: 20,
      taxPercentage: 0,
      tax: 0,
      totalAmount: 20,
      status: "RECEIVED",
      createdBy: ownerId,
      createdAt: analyticsDate,
    });
    await GoodsReceipt.create({
      businessId: ownerBusinessId,
      receiptNumber: "GR-ANALYTICS-001",
      idempotencyKey: "analytics-receipt-001",
      purchaseOrderId: purchaseOrder._id,
      supplierId: supplier._id,
      warehouseId: warehouse._id,
      products: [
        { productId: product._id, receivedQuantity: 5, damagedQuantity: 1 },
      ],
      discrepancies: "",
      receivedBy: ownerId,
      receivedAt: analyticsDate,
      createdAt: analyticsDate,
    });
    await InventoryBalance.create({
      businessId: ownerBusinessId,
      productId: product._id,
      warehouseId: warehouse._id,
      availableQuantity: 8,
      reservedQuantity: 0,
    });
    await InventoryMovement.create({
      businessId: ownerBusinessId,
      productId: product._id,
      warehouseId: warehouse._id,
      movementType: "PURCHASE_RECEIPT",
      quantity: 4,
      previousStock: 4,
      newStock: 8,
      referenceType: "ANALYTICS_TEST",
      referenceId: "analytics-purchase-001",
      performedBy: ownerId,
      createdAt: analyticsDate,
    });

    const completedSale = await SalesOrder.create({
      businessId: ownerBusinessId,
      salesOrderNumber: "SO-ANALYTICS-001",
      customerId: customer._id,
      customerName: customer.customerName,
      warehouseId: warehouse._id,
      products: [
        {
          productId: product._id,
          productName: product.productName,
          sku: product.sku,
          quantity: 3,
          unitPrice: 10,
          unitCost: 5,
          discountPercentage: 10,
          subtotal: 30,
          discountAmount: 3,
          taxableAmount: 27,
          returnedQuantity: 1,
        },
      ],
      subtotal: 30,
      discountTotal: 3,
      taxableAmount: 27,
      taxName: "GST",
      taxPercentage: 0,
      tax: 0,
      totalAmount: 27,
      status: "PARTIALLY_RETURNED",
      createdBy: ownerId,
      completedAt: saleDate,
      createdAt: saleDate,
    });
    await SalesReturn.create({
      businessId: ownerBusinessId,
      returnNumber: "SR-ANALYTICS-001",
      salesOrderId: completedSale._id,
      idempotencyKey: "analytics-return-001",
      products: [
        {
          productId: product._id,
          productName: product.productName,
          quantity: 1,
        },
      ],
      returnedBy: ownerId,
      createdAt: saleDate,
    });
    await SalesOrder.create({
      businessId: ownerBusinessId,
      salesOrderNumber: "SO-ANALYTICS-CANCELLED",
      customerId: customer._id,
      customerName: customer.customerName,
      warehouseId: warehouse._id,
      products: [
        {
          productId: product._id,
          productName: product.productName,
          sku: product.sku,
          quantity: 10,
          unitPrice: 10,
          unitCost: 5,
          discountPercentage: 0,
          subtotal: 100,
          discountAmount: 0,
          taxableAmount: 100,
          returnedQuantity: 0,
        },
      ],
      subtotal: 100,
      discountTotal: 0,
      taxableAmount: 100,
      taxName: "GST",
      taxPercentage: 0,
      tax: 0,
      totalAmount: 100,
      status: "CANCELLED",
      createdBy: ownerId,
      createdAt: saleDate,
    });
    await SalesOrder.create({
      businessId: ownerBusinessId,
      salesOrderNumber: "SO-ANALYTICS-UNCOSTED",
      customerId: customer._id,
      customerName: customer.customerName,
      warehouseId: warehouse._id,
      products: [
        {
          productId: product._id,
          productName: product.productName,
          sku: product.sku,
          quantity: 1,
          unitPrice: 10,
          discountPercentage: 0,
          subtotal: 10,
          discountAmount: 0,
          taxableAmount: 10,
          returnedQuantity: 0,
        },
      ],
      subtotal: 10,
      discountTotal: 0,
      taxableAmount: 10,
      taxName: "GST",
      taxPercentage: 0,
      tax: 0,
      totalAmount: 10,
      status: "COMPLETED",
      createdBy: ownerId,
      completedAt: missingCostDate,
      createdAt: missingCostDate,
    });

    const saleQuery =
      `/api/analytics/sales?businessId=${ownerBusinessId}` +
      "&from=2026-01-20&to=2026-01-20&period=daily";
    const sales = await request(app)
      .get(saleQuery)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(sales.status, 200, JSON.stringify(sales.body));
    assert.equal(sales.body.analytics.salesRevenue, 18);
    assert.equal(sales.body.analytics.estimatedGrossProfit, 8);
    assert.equal(sales.body.analytics.orderCounts.completed, 1);
    assert.equal(sales.body.analytics.orderCounts.cancelled, 1);
    assert.equal(sales.body.analytics.orderCounts.returned, 1);
    assert.equal(sales.body.analytics.returns.returnCount, 1);
    assert.equal(sales.body.analytics.returns.returnedQuantity, 1);
    assert.equal(sales.body.analytics.topProducts[0].quantity, 2);

    const missingCostSales = await request(app)
      .get(
        `/api/analytics/sales?businessId=${ownerBusinessId}&from=2026-01-21&to=2026-01-21`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(missingCostSales.status, 200);
    assert.equal(missingCostSales.body.analytics.salesRevenue, 10);
    assert.equal(missingCostSales.body.analytics.estimatedGrossProfit, null);
    assert.equal(missingCostSales.body.analytics.ordersMissingCost, 1);

    const emptyDateRange = await request(app)
      .get(
        `/api/analytics/sales?businessId=${ownerBusinessId}&from=2026-01-22&to=2026-01-22`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(emptyDateRange.status, 200);
    assert.equal(emptyDateRange.body.analytics.salesRevenue, 0);
    assert.equal(emptyDateRange.body.analytics.trend.length, 0);

    const purchases = await request(app)
      .get(
        `/api/analytics/purchases?businessId=${ownerBusinessId}&from=2026-01-15&to=2026-01-15&period=daily`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(purchases.status, 200, JSON.stringify(purchases.body));
    assert.equal(purchases.body.analytics.receiptCount, 1);
    assert.equal(purchases.body.analytics.receivedQuantity, 5);
    assert.equal(purchases.body.analytics.damagedQuantity, 1);
    assert.equal(purchases.body.analytics.goodQuantity, 4);
    assert.equal(purchases.body.analytics.purchaseValue, 16);
    assert.equal(
      purchases.body.analytics.supplierAnalysis[0].supplierName,
      supplier.supplierName
    );

    const expectedProducts = await Product.find({
      businessId: ownerBusinessId,
    }).lean();
    const expectedInventoryValue = expectedProducts.reduce(
      (total, item) => total + item.currentStock * item.purchasePrice,
      0
    );
    const inventory = await request(app)
      .get(
        `/api/analytics/inventory?businessId=${ownerBusinessId}&from=2026-01-15&to=2026-01-15`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(inventory.status, 200, JSON.stringify(inventory.body));
    assert.equal(inventory.body.analytics.productCount, expectedProducts.length);
    assert.equal(inventory.body.analytics.inventoryValue, expectedInventoryValue);
    assert.ok(
      inventory.body.analytics.warehouseBalances.some(
        (balance: { warehouseId: string }) =>
          balance.warehouseId === warehouse._id.toString()
      )
    );
    assert.equal(
      inventory.body.analytics.movements.some(
        (movement: { _id: string }) => movement._id === "PURCHASE_RECEIPT"
      ),
      true
    );

    const invalidDate = await request(app)
      .get(
        `/api/analytics/sales?businessId=${ownerBusinessId}&from=2026-02-30`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(invalidDate.status, 400);
    const reversedDates = await request(app)
      .get(
        `/api/reports/sales?businessId=${ownerBusinessId}&from=2026-01-22&to=2026-01-20`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(reversedDates.status, 400);

    const salesReport = await request(app)
      .get(
        `/api/reports/sales?businessId=${ownerBusinessId}&from=2026-01-20&to=2026-01-20`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(salesReport.status, 200, JSON.stringify(salesReport.body));
    assert.equal(salesReport.body.pagination.total, 1);
    assert.equal(salesReport.body.rows[0].salesRevenue, 18);
    assert.equal(salesReport.body.rows[0].estimatedGrossProfit, 8);

    const purchaseReport = await request(app)
      .get(
        `/api/reports/purchases?businessId=${ownerBusinessId}&from=2026-01-15&to=2026-01-15`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(purchaseReport.status, 200, JSON.stringify(purchaseReport.body));
    assert.equal(purchaseReport.body.pagination.total, 1);
    assert.equal(purchaseReport.body.rows[0].receivedValue, 16);

    const productReport = await request(app)
      .get(
        `/api/reports/products?businessId=${ownerBusinessId}&from=2026-01-20&to=2026-01-20`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(productReport.status, 200, JSON.stringify(productReport.body));
    assert.equal(productReport.body.pagination.total, 1);
    assert.equal(productReport.body.rows[0].productName, product.productName);
    assert.equal(productReport.body.rows[0].quantitySold, 2);

    const inventoryReport = await request(app)
      .get(
        `/api/reports/inventory?businessId=${ownerBusinessId}&search=ANALYTICS-001`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(inventoryReport.status, 200);
    assert.equal(inventoryReport.body.pagination.total, 1);
    assert.equal(inventoryReport.body.rows[0].estimatedStockValue, 40);

    const csv = await request(app)
      .get(
        `/api/reports/sales/export?businessId=${ownerBusinessId}&from=2026-01-20&to=2026-01-20&format=csv`
      )
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(csv.status, 200);
    assert.match(csv.headers["content-type"], /text\/csv/);
    assert.match(csv.text, /salesOrderNumber/);
    assert.match(csv.text, /SO-ANALYTICS-001/);

    const xlsxResponse = await request(app)
      .get(
        `/api/reports/sales/export?businessId=${ownerBusinessId}&from=2026-01-20&to=2026-01-20&format=xlsx`
      )
      .set("Authorization", `Bearer ${ownerToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    assert.equal(xlsxResponse.status, 200);
    assert.match(
      xlsxResponse.headers["content-type"],
      /spreadsheetml\.sheet/
    );
    const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(xlsxResponse.body as any);
    const worksheet = workbook.getWorksheet("Report");
    assert.ok(worksheet, "Report worksheet should exist");

    const headers = worksheet.getRow(1).values as (string | undefined)[];
    const salesRevenueColumn = headers.findIndex(
      (header) => header === "salesRevenue"
    );

    assert.ok(salesRevenueColumn > 0, "salesRevenue column should exist");
    assert.equal(
      worksheet.getRow(2).getCell(salesRevenueColumn).value,
      18
    );

    const crossBusinessAnalytics = await request(app)
      .get(`/api/analytics/overview?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(crossBusinessAnalytics.status, 403);
    const crossBusinessReport = await request(app)
      .get(`/api/reports/sales?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(crossBusinessReport.status, 403);
    const secondBusinessAnalytics = await request(app)
      .get(`/api/analytics/overview?businessId=${secondBusinessId}`)
      .set("Authorization", `Bearer ${secondToken}`);
    assert.equal(secondBusinessAnalytics.status, 200);

const expectedSecondBusinessProductCount = await Product.countDocuments({
  businessId: secondBusinessId,
});

assert.equal(
  secondBusinessAnalytics.body.analytics.productCount,
  expectedSecondBusinessProductCount
);
    await Membership.findOneAndUpdate(
      { userId: secondId, businessId: ownerBusinessId },
      { $set: { role: "SALES_EMPLOYEE" } }
    );
    for (const endpoint of [
      `/api/analytics/overview?businessId=${ownerBusinessId}`,
      `/api/analytics/sales?businessId=${ownerBusinessId}`,
      `/api/analytics/inventory?businessId=${ownerBusinessId}`,
      `/api/reports/sales?businessId=${ownerBusinessId}`,
      `/api/reports/products?businessId=${ownerBusinessId}`,
    ]) {
      const forbidden = await request(app)
        .get(endpoint)
        .set("Authorization", `Bearer ${secondToken}`);
      assert.equal(forbidden.status, 403, endpoint);
    }
    await Membership.findOneAndUpdate(
      { userId: secondId, businessId: ownerBusinessId },
      { $set: { role: "ACCOUNTANT" } }
    );
  });

  await suite.test("completes supplier CRUD, validation, associations and authorization", async () => {
    const createSupplier = (supplierName: string, email: string) =>
      request(app)
        .post("/api/suppliers")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          businessId: ownerBusinessId,
          supplierName,
          email,
          contactPerson: "Supplier Contact",
          phone: "+1 555 123 4567",
          address: "100 Supplier Street",
          taxIdentification: "TAX-001",
          paymentTerms: "Net 30",
        });

    const created = await createSupplier("Acme Supply", "sales@acme.test");
    assert.equal(created.status, 201);
    const supplierId = created.body.supplier._id as string;
    const duplicate = await createSupplier("acme supply", "other@acme.test");
    assert.equal(duplicate.status, 409);
    const invalid = await createSupplier("Invalid Supplier", "not-an-email");
    assert.equal(invalid.status, 400);

    const second = await createSupplier("Acme West", "west@acme.test");
    assert.equal(second.status, 201);

    const list = await request(app)
      .get(`/api/suppliers?businessId=${ownerBusinessId}&search=Acme&page=1&limit=1`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.pagination.total, 2);
    assert.equal(list.body.pagination.totalPages, 2);
    assert.equal(list.body.suppliers.length, 1);

    const product = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessId: ownerBusinessId,
        productName: "Supplier Linked Product",
        sku: "SUPPLIER-LINK-001",
        category: categoryId,
        purchasePrice: 12,
        sellingPrice: 18,
        supplier: supplierId,
      });
    assert.equal(product.status, 201);

    const details = await request(app)
      .get(`/api/suppliers/${supplierId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(details.status, 200);
    assert.equal(details.body.associatedProducts.length, 1);

    const protectedDelete = await request(app)
      .delete(`/api/suppliers/${supplierId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(protectedDelete.status, 409);

    const update = await request(app)
      .put(`/api/suppliers/${supplierId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, contactPerson: "Updated Contact" });
    assert.equal(update.status, 200);
    assert.equal(update.body.supplier.contactPerson, "Updated Contact");

    const accountantCreate = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId, supplierName: "Accountant Supplier" });
    assert.equal(accountantCreate.status, 403);
    const accountantUpdate = await request(app)
      .put(`/api/suppliers/${supplierId}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId, supplierName: "Changed Supplier" });
    assert.equal(accountantUpdate.status, 403);
    await Membership.updateOne(
      { userId: secondId, businessId: ownerBusinessId },
      { $set: { role: "INVENTORY_MANAGER" } }
    );
    const managerCreate = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        businessId: ownerBusinessId,
        productName: "Manager Product",
        sku: "MANAGER-001",
        category: categoryId,
        purchasePrice: 2,
        sellingPrice: 3,
      });
    assert.equal(managerCreate.status, 201);
    const managerSupplierWrite = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId, supplierName: "Manager Supplier" });
    assert.equal(managerSupplierWrite.status, 403);
    await Membership.updateOne(
      { userId: secondId, businessId: ownerBusinessId },
      { $set: { role: "ACCOUNTANT" } }
    );
    await Product.deleteOne({ _id: managerCreate.body.data._id });
    const memberList = await request(app)
      .get(`/api/suppliers?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${secondToken}`);
    assert.equal(memberList.status, 200);

    const foreignSupplier = await Supplier.create({
      businessId: secondBusinessId,
      supplierName: "Foreign Supplier",
    });
    const foreignDetails = await request(app)
      .get(`/api/suppliers/${foreignSupplier._id}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(foreignDetails.status, 404);

    const detachProduct = await request(app)
      .put(`/api/products/${product.body.data._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, supplier: "" });
    assert.equal(detachProduct.status, 200);
    const deleted = await request(app)
      .delete(`/api/suppliers/${supplierId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(deleted.status, 200);
  });
  
  await suite.test("creates and accepts employee invitations securely", async () => {
    const createInvitation = (
      token: string,
      businessId: string,
      email: string,
      role: string
    ) =>
      request(app)
        .post("/api/employees/invitations")
        .set("Authorization", `Bearer ${token}`)
        .send({ businessId, email, role });

    // Owner can create an invitation.
    const created = await createInvitation(
      ownerToken,
      ownerBusinessId,
      "manager@stockpilot.test",
      "INVENTORY_MANAGER"
    );

    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.invitation.email, "manager@stockpilot.test");
    assert.equal(created.body.invitation.role, "INVENTORY_MANAGER");
    assert.equal(created.body.invitation.status, "PENDING");
    assert.ok(created.body.invitation.expiresAt);
    assert.match(created.body.invitationToken, /^[a-f0-9]{64}$/i);

    const invitationToken = created.body.invitationToken as string;

    // The raw token is returned once; only its hash is stored.
    const tokenHash = createHash("sha256")
      .update(invitationToken)
      .digest("hex");
    const savedInvitation = await EmployeeInvitation.findOne({
      businessId: ownerBusinessId,
      email: "manager@stockpilot.test",
    })
      .select("+tokenHash")
      .lean();

    assert.ok(savedInvitation);
    assert.equal(savedInvitation?.role, "INVENTORY_MANAGER");
    assert.equal(savedInvitation?.tokenHash, tokenHash);
    assert.notEqual(savedInvitation?.tokenHash, invitationToken);

    // Duplicate pending invitation is rejected.
    const duplicate = await createInvitation(
      ownerToken,
      ownerBusinessId,
      "manager@stockpilot.test",
      "SALES_EMPLOYEE"
    );
    assert.equal(duplicate.status, 409);

    // Invalid email and unsupported role are rejected.
    const invalidEmail = await createInvitation(
      ownerToken,
      ownerBusinessId,
      "invalid-email",
      "ACCOUNTANT"
    );
    assert.equal(invalidEmail.status, 400);

    const invalidRole = await createInvitation(
      ownerToken,
      ownerBusinessId,
      "admin@stockpilot.test",
      "BUSINESS_OWNER"
    );
    assert.equal(invalidRole.status, 400);

    // A business owner cannot invite into another business.
    const foreignBusiness = await createInvitation(
      ownerToken,
      secondBusinessId,
      "foreign@stockpilot.test",
      "SALES_EMPLOYEE"
    );
    assert.equal(foreignBusiness.status, 403);

    // A non-owner member cannot create invitations.
    const memberInvitation = await createInvitation(
      secondToken,
      ownerBusinessId,
      "member@stockpilot.test",
      "ACCOUNTANT"
    );
    assert.equal(memberInvitation.status, 403);

    // Invalid token format is rejected.
    const invalidToken = await request(app)
      .post("/api/employees/invitations/accept")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ token: "not-a-valid-token" });
    assert.equal(invalidToken.status, 400);

    // A different authenticated email cannot accept this invitation.
    const wrongEmail = await request(app)
      .post("/api/employees/invitations/accept")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ token: invitationToken });
    assert.equal(wrongEmail.status, 403);

    // Create an active account for the invited email.
    const employee = await User.create({
      name: "StockPilot Employee",
      email: "manager@stockpilot.test",
      password: "TestOnlyPassword123!",
      role: "BUSINESS_OWNER",
      isActive: true,
    });

    const employeeToken = jwt.sign(
      {
        userId: employee._id.toString(),
        role: employee.role,
      },
      process.env.JWT_SECRET!
    );

    // The invited employee can accept the invitation.
    const accepted = await request(app)
      .post("/api/employees/invitations/accept")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ token: invitationToken });

    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.success, true);
    assert.equal(accepted.body.membership.businessId, ownerBusinessId);
    assert.equal(accepted.body.membership.role, "INVENTORY_MANAGER");

    const createdMembership = await Membership.findOne({
      userId: employee._id,
      businessId: ownerBusinessId,
    }).lean();

    assert.ok(createdMembership);
    assert.equal(createdMembership?.role, "INVENTORY_MANAGER");

    const acceptedInvitation = await EmployeeInvitation.findOne({
      businessId: ownerBusinessId,
      email: "manager@stockpilot.test",
    }).lean();

    assert.equal(acceptedInvitation?.status, "ACCEPTED");
    assert.ok(acceptedInvitation?.acceptedAt);
    assert.equal(
      acceptedInvitation?.acceptedBy?.toString(),
      employee._id.toString()
    );

    // The same invitation cannot be accepted twice.
    const repeatedAcceptance = await request(app)
      .post("/api/employees/invitations/accept")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ token: invitationToken });
    assert.equal(repeatedAcceptance.status, 409);

    assert.equal(
      await Membership.countDocuments({
        userId: employee._id,
        businessId: ownerBusinessId,
      }),
      1
    );

    // Expired invitations are marked EXPIRED and cannot be accepted.
    const expiredToken = "e".repeat(64);
    const expiredTokenHash = createHash("sha256")
      .update(expiredToken)
      .digest("hex");

    const expiredInvitation = await EmployeeInvitation.create({
      businessId: ownerBusinessId,
      email: "expired@stockpilot.test",
      role: "ACCOUNTANT",
      tokenHash: expiredTokenHash,
      status: "PENDING",
      expiresAt: new Date(Date.now() - 60_000),
    });

    const expiredAcceptance = await request(app)
      .post("/api/employees/invitations/accept")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ token: expiredToken });

    assert.equal(expiredAcceptance.status, 410);

    const refreshedExpiredInvitation = await EmployeeInvitation.findById(
      expiredInvitation._id
    ).lean();

    assert.equal(refreshedExpiredInvitation?.status, "EXPIRED");
    assert.equal(
      await Membership.countDocuments({
        userId: employee._id,
        businessId: ownerBusinessId,
        role: "ACCOUNTANT",
      }),
      0
    );
  });

  await suite.test("lists business employees with search, role filters, pagination and owner authorization", async () => {
    const listEmployees = (
      token: string,
      businessId: string,
      query = ""
    ) =>
      request(app)
        .get(`/api/employees?businessId=${businessId}${query}`)
        .set("Authorization", `Bearer ${token}`);

    // Owner can list employees in their own business.
    const firstPage = await listEmployees(
      ownerToken,
      ownerBusinessId,
      "&page=1&limit=1"
    );

    assert.equal(firstPage.status, 200, JSON.stringify(firstPage.body));
    assert.equal(firstPage.body.success, true);
    assert.equal(firstPage.body.pagination.total, 3);
    assert.equal(firstPage.body.pagination.page, 1);
    assert.equal(firstPage.body.pagination.limit, 1);
    assert.equal(firstPage.body.pagination.totalPages, 3);
    assert.equal(firstPage.body.employees.length, 1);

    const secondPage = await listEmployees(
      ownerToken,
      ownerBusinessId,
      "&page=2&limit=1"
    );

    assert.equal(secondPage.status, 200, JSON.stringify(secondPage.body));
    assert.equal(secondPage.body.employees.length, 1);
    assert.notEqual(
      firstPage.body.employees[0]._id,
      secondPage.body.employees[0]._id
    );

    // The invited manager is searchable by name/email.
    const managerSearch = await listEmployees(
      ownerToken,
      ownerBusinessId,
      "&search=manager%40stockpilot.test"
    );

    assert.equal(managerSearch.status, 200);
    assert.equal(managerSearch.body.pagination.total, 1);
    assert.equal(
      managerSearch.body.employees[0].userId.email,
      "manager@stockpilot.test"
    );
    assert.equal(
      managerSearch.body.employees[0].role,
      "INVENTORY_MANAGER"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        managerSearch.body.employees[0].userId,
        "password"
      ),
      false
    );

    // Role filter returns only the requested employee role.
    const accountantFilter = await listEmployees(
      ownerToken,
      ownerBusinessId,
      "&role=ACCOUNTANT"
    );

    assert.equal(accountantFilter.status, 200);
    assert.equal(accountantFilter.body.pagination.total, 1);
    assert.equal(
      accountantFilter.body.employees[0].role,
      "ACCOUNTANT"
    );

    // Search by employee name also works.
    const nameSearch = await listEmployees(
      ownerToken,
      ownerBusinessId,
      "&search=Owner%20Two"
    );

    assert.equal(nameSearch.status, 200);
    assert.equal(nameSearch.body.pagination.total, 1);
    assert.equal(nameSearch.body.employees[0].userId.name, "Owner Two");

    // Invalid role and pagination are rejected.
    const invalidRole = await listEmployees(
      ownerToken,
      ownerBusinessId,
      "&role=BUSINESS_OWNER"
    );
    assert.equal(invalidRole.status, 400);

    const invalidPage = await listEmployees(
      ownerToken,
      ownerBusinessId,
      "&page=0"
    );
    assert.equal(invalidPage.status, 400);

    const excessiveLimit = await listEmployees(
      ownerToken,
      ownerBusinessId,
      "&limit=101"
    );
    assert.equal(excessiveLimit.status, 400);

    // An ordinary business member cannot list employees.
    const nonOwnerList = await listEmployees(
      secondToken,
      ownerBusinessId
    );
    assert.equal(nonOwnerList.status, 403);

    // The owner cannot list members of another business.
    const crossBusinessList = await listEmployees(
      ownerToken,
      secondBusinessId
    );
    assert.equal(crossBusinessList.status, 403);

    // Missing business context is rejected.
    const missingBusiness = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(missingBusiness.status, 400);
  });

  await suite.test("updates employee roles and manages deactivation and reactivation securely", async () => {
    // 1. Locate the employee created in invitation acceptance
    const managerMember = await Membership.findOne({
      businessId: ownerBusinessId,
      role: "INVENTORY_MANAGER",
    });
    assert.ok(managerMember);
    const managerMemberId = managerMember!._id.toString();

    // 2. Successful role update to SALES_EMPLOYEE
    const roleUpdate = await request(app)
      .patch(`/api/employees/${managerMemberId}/role`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, role: "SALES_EMPLOYEE" });
    assert.equal(roleUpdate.status, 200);
    assert.equal(roleUpdate.body.success, true);
    assert.equal(roleUpdate.body.employee.role, "SALES_EMPLOYEE");

    const updatedRoleRecord = await Membership.findById(managerMemberId).lean();
    assert.equal(updatedRoleRecord?.role, "SALES_EMPLOYEE");

    const roleAudit = await AuditLog.findOne({
      businessId: ownerBusinessId,
      action: "EMPLOYEE_ROLE_UPDATED",
      resourceId: managerMemberId,
    }).lean();
    assert.ok(roleAudit);

    // 3. Invalid role rejection
    const invalidRole = await request(app)
      .patch(`/api/employees/${managerMemberId}/role`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, role: "INVALID_ROLE" });
    assert.equal(invalidRole.status, 400);

    const ownerRoleAssign = await request(app)
      .patch(`/api/employees/${managerMemberId}/role`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, role: "BUSINESS_OWNER" });
    assert.equal(ownerRoleAssign.status, 400);

    // 4. Invalid employee ID rejection
    const invalidId = await request(app)
      .patch("/api/employees/not-an-id/role")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, role: "ACCOUNTANT" });
    assert.equal(invalidId.status, 400);

    // 5. Foreign-business employee protection
    const foreignUser = await User.create({
      name: "Foreign Employee",
      email: "foreign-emp@stockpilot.test",
      password: "ForeignPass123!",
      role: "BUSINESS_OWNER",
    });
    const foreignMember = await Membership.create({
      userId: foreignUser._id,
      businessId: secondBusinessId,
      role: "INVENTORY_MANAGER",
    });
    const foreignUpdate = await request(app)
      .patch(`/api/employees/${foreignMember._id}/role`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, role: "ACCOUNTANT" });
    assert.equal(foreignUpdate.status, 404);

    // 6. Owner role and deactivation protection
    const ownerMember = await Membership.findOne({
      userId: ownerId,
      businessId: ownerBusinessId,
    });
    assert.ok(ownerMember);
    const ownerRoleChange = await request(app)
      .patch(`/api/employees/${ownerMember!._id}/role`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, role: "ACCOUNTANT" });
    assert.equal(ownerRoleChange.status, 400);

    const ownerDeactivate = await request(app)
      .patch(`/api/employees/${ownerMember!._id}/deactivate`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(ownerDeactivate.status, 400);

    const ownerDelete = await request(app)
      .delete(`/api/employees/${ownerMember!._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(ownerDelete.status, 400);

    // 7. Unauthorized user rejection (non-owner member)
    const unauthorizedRoleUpdate = await request(app)
      .patch(`/api/employees/${managerMemberId}/role`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId, role: "ACCOUNTANT" });
    assert.equal(unauthorizedRoleUpdate.status, 403);

    const unauthorizedDeactivate = await request(app)
      .patch(`/api/employees/${managerMemberId}/deactivate`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(unauthorizedDeactivate.status, 403);

    // 8. Employee deactivation
    const deactivation = await request(app)
      .patch(`/api/employees/${managerMemberId}/deactivate`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(deactivation.status, 200);
    assert.equal(deactivation.body.success, true);
    assert.equal(deactivation.body.employee.status, "INACTIVE");
    assert.equal(deactivation.body.employee.isActive, false);

    const deactivatedRecord = await Membership.findById(managerMemberId).lean();
    assert.equal(deactivatedRecord?.status, "INACTIVE");
    assert.equal(deactivatedRecord?.isActive, false);

    const deactivationAudit = await AuditLog.findOne({
      businessId: ownerBusinessId,
      action: "EMPLOYEE_DEACTIVATED",
      resourceId: managerMemberId,
    }).lean();
    assert.ok(deactivationAudit);

    // Deactivated employee cannot access business resources
    const employeeUser = await User.findOne({ email: "manager@stockpilot.test" }).lean();
    assert.ok(employeeUser);
    const employeeJwt = jwt.sign(
      { userId: employeeUser!._id.toString(), role: "BUSINESS_OWNER" },
      process.env.JWT_SECRET!
    );
    const deactivatedAccess = await request(app)
      .get(`/api/categories?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${employeeJwt}`);
    assert.equal(deactivatedAccess.status, 403);

    // 9. Employee reactivation
    const reactivation = await request(app)
      .patch(`/api/employees/${managerMemberId}/reactivate`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(reactivation.status, 200);
    assert.equal(reactivation.body.success, true);
    assert.equal(reactivation.body.employee.status, "ACTIVE");
    assert.equal(reactivation.body.employee.isActive, true);

    const reactivatedRecord = await Membership.findById(managerMemberId).lean();
    assert.equal(reactivatedRecord?.status, "ACTIVE");
    assert.equal(reactivatedRecord?.isActive, true);

    const reactivationAudit = await AuditLog.findOne({
      businessId: ownerBusinessId,
      action: "EMPLOYEE_REACTIVATED",
      resourceId: managerMemberId,
    }).lean();
    assert.ok(reactivationAudit);

    // Reactivated employee can now access business resources
    const reactivatedAccess = await request(app)
      .get(`/api/categories?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${employeeJwt}`);
    assert.equal(reactivatedAccess.status, 200);

    // 10. Status filter verification in employee list
    const activeList = await request(app)
      .get(`/api/employees?businessId=${ownerBusinessId}&status=ACTIVE`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(activeList.status, 200);
    assert.equal(activeList.body.employees.length >= 1, true);

    // 11. Soft removal via DELETE
    const softRemove = await request(app)
      .delete(`/api/employees/${managerMemberId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(softRemove.status, 200);
    assert.equal(softRemove.body.success, true);

    // Ensure record still exists in DB (not permanently deleted, preserving historical references)
    const preservedRecord = await Membership.findById(managerMemberId).lean();
    assert.ok(preservedRecord);
    assert.equal(preservedRecord?.status, "INACTIVE");

    // Re-activate and reset role so subsequent test cleanup or queries remain healthy
    await Membership.findByIdAndUpdate(managerMemberId, {
      $set: { status: "ACTIVE", isActive: true, role: "INVENTORY_MANAGER" },
    });
  });

  await suite.test("completes customer CRUD, validation, search and authorization", async () => {
    const createCustomer = (customerName: string, email: string) =>
      request(app)
        .post("/api/customers")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          businessId: ownerBusinessId,
          customerName,
          email,
          phone: "+1 555 123 4567",
          address: "200 Customer Avenue",
        });

const created = await createCustomer("CRUDCustomer One", "one@customer.test");    assert.equal(created.status, 201);
    const customerId = created.body.customer._id as string;
    const duplicate = await createCustomer("Another Name", "ONE@customer.test");
    assert.equal(duplicate.status, 409);
    const invalidEmail = await createCustomer("Invalid Email", "bad-email");
    assert.equal(invalidEmail.status, 400);
    const invalidPhone = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, customerName: "Invalid Phone", phone: "x" });
    assert.equal(invalidPhone.status, 400);

const second = await createCustomer("CRUDCustomer Two", "two@customer.test");    assert.equal(second.status, 201);
    const list = await request(app)
.get(`/api/customers?businessId=${ownerBusinessId}&search=CRUDCustomer&page=1&limit=1`)      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.pagination.total, 2);
    assert.equal(list.body.pagination.totalPages, 2);
    assert.equal(list.body.customers.length, 1);

    const details = await request(app)
      .get(`/api/customers/${customerId}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(details.status, 200);
    assert.equal(details.body.customer.email, "one@customer.test");

    const update = await request(app)
      .put(`/api/customers/${customerId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId, customerName: "Customer One Updated" });
    assert.equal(update.status, 200);
    assert.equal(update.body.customer.customerName, "Customer One Updated");

    const accountantCreate = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId, customerName: "Accountant Customer" });
    assert.equal(accountantCreate.status, 403);
    const accountantDelete = await request(app)
      .delete(`/api/customers/${customerId}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(accountantDelete.status, 403);
    const memberList = await request(app)
      .get(`/api/customers?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${secondToken}`);
    assert.equal(memberList.status, 200);

    const foreignCustomer = await Customer.create({
      businessId: secondBusinessId,
      customerName: "Foreign Customer",
      email: "foreign@customer.test",
    });
    const foreignDetails = await request(app)
      .get(`/api/customers/${foreignCustomer._id}?businessId=${ownerBusinessId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(foreignDetails.status, 404);

    const deleted = await request(app)
      .delete(`/api/customers/${customerId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId: ownerBusinessId });
    assert.equal(deleted.status, 200);
    assert.equal(await Customer.exists({ _id: customerId }), null);
  });

  await suite.test("cleans test records and disconnects", async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
});
