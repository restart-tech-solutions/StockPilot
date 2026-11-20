# StockPilot – Database Design

**Product:** StockPilot
**Developed By:** Restart Tech Solutions
**Database:** MongoDB
**Database Type:** NoSQL Document Database

---

## 1. Database Overview

StockPilot uses MongoDB to store business, user, product, inventory, purchase, sales, invoice, forecasting and subscription information.

Every business-owned record must contain the relevant business identifier to maintain business-level data isolation.

---

## 2. Core Collections

StockPilot contains the following 20 core collections.

1. users
2. businesses
3. memberships
4. roles
5. products
6. categories
7. suppliers
8. customers
9. warehouses
10. purchaseOrders
11. goodsReceipts
12. salesOrders
13. invoices
14. inventoryBalances
15. inventoryMovements
16. forecasts
17. notifications
18. auditLogs
19. subscriptions

Note: The original architecture also specifies all these collections as its core data entities. The collection names above follow that specification.

---

## 3. Collection Structure

### 3.1 users

Purpose: Store user account information.

Fields:
- _id
- name
- email
- passwordHash
- phone
- isActive
- createdAt
- updatedAt

### 3.2 businesses

Purpose: Store business workspace information.

Fields:
- _id
- businessName
- businessCategory
- contactEmail
- contactPhone
- address
- location
- currency
- ownerId
- taxSettings
- invoiceSettings
- createdAt
- updatedAt

### 3.3 memberships

Purpose: Associate users with business workspaces.

Fields:
- _id
- businessId
- userId
- roleId
- status
- joinedAt
- createdAt
- updatedAt

### 3.4 roles

Purpose: Define user roles and permissions.

Fields:
- _id
- businessId
- roleName
- permissions
- createdAt
- updatedAt

### 3.5 products

Purpose: Store product information.

Fields:
- _id
- businessId
- productName
- SKU
- barcode
- categoryId
- brand
- purchasePrice
- sellingPrice
- currentStock
- minimumStock
- supplierId
- description
- image
- createdAt
- updatedAt

### 3.6 categories

Purpose: Organize products into categories.

Fields:
- _id
- businessId
- categoryName
- description
- createdAt
- updatedAt

### 3.7 suppliers

Purpose: Maintain supplier information.

Fields:
- _id
- businessId
- supplierName
- companyName
- contactPerson
- email
- phone
- address
- taxIdentification
- paymentTerms
- createdAt
- updatedAt

### 3.8 customers

Purpose: Maintain customer information.

Fields:
- _id
- businessId
- customerName
- email
- phone
- address
- createdAt
- updatedAt

### 3.9 warehouses

Purpose: Store warehouse information.

Fields:
- _id
- businessId
- warehouseName
- location
- address
- managerId
- createdAt
- updatedAt

### 3.10 purchaseOrders

Purpose: Store purchase order records.

Fields:
- _id
- businessId
- purchaseOrderNumber
- supplierId
- products
- subtotal
- tax
- totalAmount
- status
- expectedDeliveryDate
- createdBy
- createdAt
- updatedAt

### 3.11 goodsReceipts

Purpose: Record received goods and quantities.

Fields:
- _id
- businessId
- purchaseOrderId
- supplierId
- warehouseId
- receivedProducts
- damagedProducts
- discrepancies
- receivedBy
- receivedAt
- createdAt

### 3.12 salesOrders

Purpose: Store customer sales transactions.

Fields:
- _id
- businessId
- salesOrderNumber
- customerId
- products
- subtotal
- discount
- tax
- totalAmount
- status
- createdBy
- createdAt
- updatedAt

### 3.13 invoices

Purpose: Store invoice information.

Fields:
- _id
- businessId
- invoiceNumber
- salesOrderId
- customerId
- invoiceDate
- products
- subtotal
- discount
- tax
- totalAmount
- paymentStatus
- createdAt
- updatedAt

### 3.14 inventoryBalances

Purpose: Maintain available stock quantities.

Fields:
- _id
- businessId
- productId
- warehouseId
- availableQuantity
- reservedQuantity
- updatedAt

### 3.15 inventoryMovements

Purpose: Maintain an auditable record of stock changes.

Fields:
- _id
- businessId
- productId
- warehouseId
- movementType
- quantity
- referenceType
- referenceId
- previousQuantity
- newQuantity
- performedBy
- createdAt

Movement types:
- Stock In
- Stock Out
- Purchase Receipt
- Sales Deduction
- Stock Adjustment
- Stock Transfer
- Damaged Stock
- Returned Stock

### 3.16 forecasts

Purpose: Store machine learning demand predictions.

Fields:
- _id
- businessId
- productId
- forecastPeriod
- predictedDemand
- recommendedReorderQuantity
- modelName
- evaluationMetrics
- generatedAt
- createdAt

### 3.17 notifications

Purpose: Store system notifications.

Fields:
- _id
- businessId
- userId
- notificationType
- title
- message
- isRead
- createdAt

### 3.18 auditLogs

Purpose: Maintain records of important system activities.

Fields:
- _id
- businessId
- userId
- action
- module
- recordId
- description
- createdAt

### 3.19 subscriptions

Purpose: Manage business subscription information.

Fields:
- _id
- businessId
- planName
- status
- startDate
- endDate
- createdAt
- updatedAt

---

## 4. Collection Relationships

Users and Businesses:
- A user can belong to multiple business workspaces.
- Memberships associate users with businesses.
- Memberships reference roles.

Business and Products:
- A business can have multiple products.
- Products reference categories and suppliers.

Business and Suppliers:
- A business can maintain multiple suppliers.
- Suppliers can be associated with multiple products.

Business and Customers:
- A business can maintain multiple customers.
- Customers can have multiple sales orders.

Purchase Management:
- Purchase orders reference suppliers.
- Goods receipts reference purchase orders.
- Goods receipts update inventory after confirmed receipt.

Sales Management:
- Sales orders reference customers.
- Invoices reference sales orders.
- Confirmed sales update inventory.

Inventory Management:
- Inventory balances reference products and warehouses.
- Inventory movements maintain stock change history.

Machine Learning:
- Forecasts reference products.
- Forecasts store predicted demand and reorder recommendations.

Subscriptions:
- Each subscription belongs to a business.

---

## 5. Business-Level Data Isolation

Every business-owned collection must contain businessId.

Requirements:
- Verify business membership before accessing records.
- Apply businessId filters to database queries.
- Validate user permissions on the backend.
- Prevent access to another business's records.
- Never trust businessId supplied by the frontend without server-side verification.

---

## 6. Database Indexing Requirements

Recommended indexes:

users:
- email

businesses:
- ownerId

memberships:
- businessId + userId

products:
- businessId + SKU
- businessId + barcode
- businessId + categoryId

categories:
- businessId + categoryName

suppliers:
- businessId

customers:
- businessId

purchaseOrders:
- businessId + purchaseOrderNumber

salesOrders:
- businessId + salesOrderNumber

invoices:
- businessId + invoiceNumber

inventoryBalances:
- businessId + productId + warehouseId

inventoryMovements:
- businessId + productId + createdAt

forecasts:
- businessId + productId + generatedAt

subscriptions:
- businessId

Unique constraints must be designed according to business-level ownership.

---

## 7. Data Integrity Requirements

- Use MongoDB ObjectId references.
- Validate required fields.
- Validate business ownership.
- Maintain accurate inventory balances.
- Record every stock-changing operation.
- Use database transactions for related critical operations where supported.
- Prevent unauthorized stock modifications.
- Maintain consistent purchase and sales records.

---

## 8. Database Security

- Keep MongoDB credentials in environment variables.
- Never expose database credentials in frontend code.
- Use authenticated database connections.
- Restrict database access.
- Configure database backups.
- Apply server-side authorization.
- Protect business-owned records from cross-tenant access.

---

## 9. Database Objective

The MongoDB database must provide a reliable foundation for StockPilot's business workspace, inventory operations, purchases, sales, invoices, analytics and AI demand forecasting.

**Built by Restart Tech Solutions**

Smart Inventory. Better Decisions. Higher Profits.
