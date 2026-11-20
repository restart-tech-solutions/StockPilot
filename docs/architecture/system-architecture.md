# StockPilot – System Architecture

**Product:** StockPilot
**Developed By:** Restart Tech Solutions
**Architecture:** Modular SaaS Architecture

---

## 1. Architecture Overview

StockPilot consists of four primary technical components:

1. Frontend Application
2. Backend Application
3. MongoDB Database
4. Machine Learning Service

The frontend communicates with the backend through REST APIs.

The backend manages business logic, authentication, authorization, inventory calculations and database operations.

The ML service analyzes historical sales data and generates demand forecasts and reorder recommendations.

---

## 2. High-Level Architecture

                    STOCKPILOT USERS
                           |
                           v
                  REACT FRONTEND
                TypeScript + Tailwind
                           |
                           v
                    REST API LAYER
                           |
                           v
                  NODE.JS + EXPRESS
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
       AUTHENTICATION   BUSINESS      INVENTORY
       & AUTHORIZATION   MODULES       OPERATIONS
             |             |             |
             +-------------+-------------+
                           |
                           v
                     MONGODB
                           |
                           v
                  HISTORICAL SALES DATA
                           |
                           v
                   PYTHON ML SERVICE
                           |
                           v
                 DEMAND FORECASTING
                           |
                           v
               REORDER RECOMMENDATIONS
                           |
                           v
                  BACKEND REST APIs
                           |
                           v
                  REACT DASHBOARD

---

## 3. Frontend Architecture

**Technology:**
- React
- TypeScript
- Tailwind CSS
- React Router
- Recharts
- React Hook Form
- Zod

### Responsibilities

- User interface.
- Authentication screens.
- Business dashboards.
- Product management forms.
- Supplier and customer management.
- Purchase and sales interfaces.
- Invoice management.
- Inventory visualization.
- Analytics and charts.
- Role-based navigation.
- API communication.

### Main Frontend Modules

- Authentication
- Business Workspace
- Products
- Categories
- Suppliers
- Customers
- Purchases
- Inventory
- Warehouses
- Sales
- Invoices
- Alerts
- Forecasting
- Analytics
- Reports
- Employees
- Subscriptions
- Notifications
- Audit Logs
- Super Admin

---

## 4. Backend Architecture

**Technology:**
- Node.js
- Express.js
- TypeScript
- REST APIs
- JWT Authentication

### Responsibilities

- Authentication and authorization.
- Business logic.
- API endpoints.
- Inventory calculations.
- Purchase processing.
- Sales processing.
- Invoice generation.
- Stock alerts.
- Notification handling.
- ML service communication.
- Business-level data isolation.

### Backend Components

1. Configuration
2. Controllers
3. Middleware
4. Models
5. Routes
6. Services
7. Validators
8. Utilities
9. Jobs
10. Events
11. Integrations

---

## 5. Database Architecture

**Database:** MongoDB

### Core Collections

- users
- businesses
- memberships
- roles
- products
- categories
- suppliers
- customers
- warehouses
- purchaseOrders
- goodsReceipts
- salesOrders
- invoices
- inventoryBalances
- inventoryMovements
- forecasts
- notifications
- auditLogs
- subscriptions

### Database Requirements

- Every business-owned record must contain the relevant business identifier.
- Business data must remain isolated.
- Inventory movements must be auditable.
- Stock-changing operations must be reliable.
- Database backups must be configured.

---

## 6. Machine Learning Architecture

**Technology:**
- Python
- Pandas
- NumPy
- Scikit-learn
- XGBoost

### ML Responsibilities

- Historical sales analysis.
- Data cleaning and validation.
- Time-based feature generation.
- Demand forecasting.
- Forecast evaluation.
- Reorder recommendations.

### ML Workflow

1. Collect historical sales data.
2. Validate and clean datasets.
3. Aggregate sales by product and time period.
4. Generate time-based features.
5. Train forecasting models.
6. Evaluate model performance.
7. Generate future demand predictions.
8. Calculate recommended reorder quantities.
9. Return forecast results to the backend.
10. Display forecasts in the dashboard.

The ML service communicates with the backend through secured internal APIs.

---

## 7. Authentication and Authorization Flow

1. User submits login credentials.
2. Backend validates credentials.
3. Password is verified securely.
4. Backend generates an authentication token.
5. Frontend receives the authentication response.
6. Protected API requests are authenticated.
7. Backend checks user role and permissions.
8. Authorized requests are processed.

---

## 8. Inventory Data Flow

### Purchase Flow

Purchase Order
    |
    v
Supplier Selection
    |
    v
Product and Quantity
    |
    v
Purchase Approval
    |
    v
Goods Receipt
    |
    v
Inventory Update
    |
    v
Inventory Movement Record

### Sales Flow

Customer Order
    |
    v
Product Selection
    |
    v
Stock Availability Check
    |
    v
Order Confirmation
    |
    v
Invoice Generation
    |
    v
Inventory Deduction
    |
    v
Sales History Update

---

## 9. Security Architecture

- Secure password hashing.
- JWT-based authentication.
- Role-based access control.
- Business-level data isolation.
- Server-side input validation.
- Rate limiting.
- HTTPS.
- Secure environment variables.
- Audit logging.
- Database backups.
- Secure file uploads.

Financial and stock-changing operations must be validated on the server.

---

## 10. Deployment Architecture

### Frontend
Vercel

### Backend
Render or another suitable cloud hosting provider.

### Database
MongoDB Atlas

### Machine Learning Service
Separately deployed Python-based service.

### Domain
Custom StockPilot product domain.

---

## 11. Production Deployment Flow

1. Configure production environment variables.
2. Configure database access.
3. Deploy backend.
4. Deploy ML service.
5. Deploy frontend.
6. Configure HTTPS.
7. Configure monitoring and logging.
8. Test production workflows.
9. Configure backups.
10. Publish the live application.

---

## 12. Architecture Objective

The architecture provides a modular foundation for StockPilot's inventory management, business operations, analytics and AI-based demand forecasting.

**Built by Restart Tech Solutions**

Smart Inventory. Better Decisions. Higher Profits.
