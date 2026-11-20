# StockPilot – Project Requirements Document

**Product:** StockPilot
**Developed By:** Restart Tech Solutions
**Category:** SaaS | Inventory Management | Business Intelligence | AI/ML

## 1. Project Overview

StockPilot is a cloud-based inventory and business management platform designed for retailers, wholesalers, distributors, warehouses and small-to-medium enterprises.

The platform manages:
- Products and categories
- Inventory and warehouses
- Suppliers and customers
- Purchases and sales
- Invoices
- Employees
- Business analytics
- AI-based demand forecasting

## 2. Primary Objectives

- Reduce manual inventory management.
- Minimize stock-related losses.
- Track real-time stock availability.
- Prevent unexpected stockouts.
- Reduce excess inventory.
- Centralize sales and purchase records.
- Provide business performance reports.
- Predict future product demand using ML.

## 3. Target Customers

- Retail stores
- Wholesale businesses
- Electronics stores
- Garment and fashion businesses
- Grocery and supermarkets
- Distributors
- Warehouses
- Small and medium enterprises

## 4. User Roles

### Super Admin
- Manage business accounts.
- Manage subscriptions.
- Monitor platform usage.
- Manage system configuration.
- View platform analytics.
- Manage support requests.

### Business Owner
- Manage business dashboard.
- Manage products and categories.
- Manage suppliers and customers.
- Monitor purchases and sales.
- Manage employees.
- View reports and analytics.
- Configure stock alerts.
- Access demand forecasting.

### Inventory Manager
- Manage products.
- Manage stock movements.
- Record purchases.
- Track stock availability.
- Manage warehouses.
- Generate inventory reports.

### Sales Employee
- Create sales orders.
- Generate invoices.
- Check product availability.
- Process sales transactions.

### Accountant
- View sales and purchase records.
- Monitor revenue and expenses.
- Review invoices.
- Export financial reports.

## 5. Functional Requirements

### Authentication and Authorization
- User registration.
- User login.
- Secure password hashing.
- JWT-based authentication.
- Role-based access control.

### Business Workspace
- Create business workspace.
- Configure business information.
- Configure currency and location.
- Configure tax and invoice settings.
- Invite employees.

### Product Management
- Add products.
- Update products.
- Delete products.
- Manage SKU and barcode.
- Manage categories and brands.
- Set purchase and selling prices.
- Configure minimum stock levels.
- Upload product images.

### Supplier Management
- Add suppliers.
- Update supplier details.
- Associate suppliers with products.
- Track purchase history.
- Record supplier payments where supported.

### Purchase Management
- Create purchase orders.
- Select suppliers.
- Add products and quantities.
- Calculate subtotal, tax and total.
- Approve purchase orders.
- Receive goods.
- Record damaged or missing goods.
- Update inventory after confirmed receipt.

### Inventory Management
- Stock In.
- Stock Out.
- Sales Deduction.
- Purchase Receipt.
- Stock Adjustment.
- Stock Transfer.
- Damaged Stock.
- Returned Stock.
- Maintain inventory movement history.

### Sales Management
- Search products.
- Check stock availability.
- Create sales orders.
- Add customer information.
- Apply authorized discounts.
- Calculate taxes.
- Generate invoices.
- Update inventory after confirmed sales.

### Invoice Management
- Generate invoices.
- Download PDF invoices.
- Track payment status.
- Search invoices.
- Support paid, unpaid, partially paid and refunded statuses.

### Stock Alerts
- Low stock alerts.
- Out of stock alerts.
- Reorder recommendations.
- Dashboard notifications.
- Optional email notifications.

### AI Demand Forecasting
- Collect historical sales data.
- Clean and validate datasets.
- Generate time-based features.
- Train forecasting models.
- Evaluate model performance.
- Predict future demand.
- Calculate recommended reorder quantities.

### Business Analytics
- Total products.
- Total inventory value.
- Total sales.
- Purchase value.
- Estimated gross profit.
- Low stock products.
- Out of stock products.
- Top-selling products.
- Sales trends.
- Reports and exports.

### Employee Management
- Invite employees.
- Assign roles.
- Manage permissions.
- Restrict unauthorized access.

### Subscription and Billing
- Starter plan.
- Growth plan.
- Enterprise plan.
- Subscription management.

### Super Admin Panel
- Manage business accounts.
- Manage subscriptions.
- Monitor platform usage.
- View platform-level analytics.
- Manage support requests.

## 6. Non-Functional Requirements

### Security
- Secure password hashing.
- JWT authentication.
- Role-based authorization.
- Business-level data isolation.
- Server-side input validation.
- Rate limiting.
- HTTPS.
- Secure environment variables.
- Audit logging.
- Database backups.
- Secure file uploads.

### Performance
- Efficient product search.
- Responsive dashboards.
- Support large inventory imports.
- Handle concurrent sales operations.
- Optimize report generation.

### Reliability
- Transaction-safe inventory updates.
- Prevent unauthorized stock changes.
- Maintain inventory movement records.
- Protect against overselling.
- Support backup and recovery.

### Scalability
- Multiple business accounts.
- Multiple warehouses.
- Modular application architecture.
- Separate ML service.

## 7. Technology Stack

### Frontend
- React
- TypeScript
- Tailwind CSS
- React Router
- Recharts
- React Hook Form
- Zod

### Backend
- Node.js
- Express.js
- TypeScript
- REST APIs
- JWT

### Database
- MongoDB

### Machine Learning
- Python
- Pandas
- NumPy
- Scikit-learn
- XGBoost

## 8. Main Application Modules

1. Authentication and Authorization
2. Business Workspace Management
3. Product Management
4. Category Management
5. Supplier Management
6. Customer Management
7. Purchase Management
8. Inventory Management
9. Warehouse Management
10. Sales Management
11. Invoice Management
12. Stock Alerts
13. AI Demand Forecasting
14. Business Analytics
15. Reports and Exports
16. Employee Management
17. Subscription and Billing
18. Notifications
19. Audit Logs
20. Super Admin Panel

## 9. Production Readiness Criteria

- Core business workflows work end to end.
- Inventory calculations are reliable.
- Business data is isolated.
- Permissions are tested.
- Sales and purchase records are auditable.
- Reports match underlying records.
- Forecasting is evaluated.
- Security testing is completed.
- Production deployment is verified.
- Backup and recovery procedures are tested.
- Customer documentation is available.

## 10. Product Vision

StockPilot aims to provide a unified inventory and business intelligence platform that helps businesses move from manual operations to data-driven management.

**Built by Restart Tech Solutions**

Smart Inventory. Better Decisions. Higher Profits.
