# StockPilot – UI/UX Design Specification

## 1. Product
- Product Name: StockPilot
- Developer: Restart Tech Solutions
- Tagline: Smart Inventory. Better Decisions. Higher Profits.

## 2. User Roles
1. Super Admin
2. Business Owner
3. Inventory Manager
4. Sales Employee
5. Accountant

The interface must display functionality according to the user's assigned role and permissions.

## Approved Visual and Product Decisions
- Use text-based StockPilot branding for now. Do not create or assume a final logo.
- Support Desktop, Tablet and Mobile layouts.
- Use comfortable, readable professional table layouts.
- Default currency is INR (₹).
- Use the Indian date format: DD/MM/YYYY.

## 3. Main Application Screens

### Authentication
- Login
- Registration

### Business Workspace
- Business setup
- Business workspace

### Product Management
- Product listing
- Add product
- Edit product
- Product details

### Category Management
- Category listing
- Add category
- Edit category

### Supplier Management
- Supplier listing
- Add supplier
- Supplier details

### Customer Management
- Customer listing
- Add customer
- Customer details

### Purchase Management
- Purchase order listing
- Create purchase order
- Goods receipt

### Inventory Management
- Current stock
- Inventory movements
- Stock details

### Warehouse Management
- Warehouse listing
- Warehouse details

### Sales Management
- Sales order listing
- Create sales order
- Sales details

### Invoice Management
- Invoice listing
- Invoice details

### Stock Alerts
- Low-stock alerts
- Stock-related notifications

### AI Demand Forecasting
- Demand forecasts
- Reorder recommendations

### Business Analytics
- Business dashboard
- Sales trends
- Inventory analytics

### Reports and Exports
- Business reports
- Report export

### Employee Management
- Employee listing
- Employee details
- Role and permission management

### Subscription and Billing
- Subscription details
- Billing information

### Notifications
- Notification listing

### Audit Logs
- Activity history

### Super Admin Panel
- Platform administration

## 4. Main Navigation
The application navigation must provide access to the modules available to the logged-in user's role.

## 5. Important User Workflows

### Business Registration
Registration → Business Setup → Business Workspace

### Product Setup
Product Management → Add Product → Save Product

### Purchase and Stock
Purchase Order → Goods Receipt → Inventory Stock Update

### Sales and Stock
Sales Order → Confirm Sale → Inventory Stock Deduction → Invoice

### Demand Forecasting
Sales Data → ML Forecasting → Demand Forecast → Reorder Recommendation

### Business Analytics
Business Data → Analytics Dashboard → Reports

## 6. UI/UX Requirements
- Clear navigation between modules.
- Consistent layouts across application screens.
- Role-based access to screens and actions.
- Forms for creating and updating business records.
- Tables or lists for viewing business records.
- Clear feedback for successful and failed operations.
- Responsive frontend interface.
- Use the text-based StockPilot name as the product branding. Do not design or assume a final logo.
- Provide Desktop, Tablet and Mobile layouts.
- Use comfortable table row height and spacing for readable professional tables.
- Display the default currency as INR (₹) and dates as DD/MM/YYYY.
- Use currency and date formatting consistently across dashboards, reports, invoices and transaction screens.

## 7. Low-Fidelity Wireframe Layouts

### 7.1 Authentication

#### Login screen

```text
+------------------------------------------------------------------+
| StockPilot                                                       |
|                                                                  |
|                   [ Login to StockPilot ]                        |
|                                                                  |
|                   Email                                          |
|                   [________________________________]               |
|                                                                  |
|                   Password                                       |
|                   [________________________________]               |
|                                                                  |
|                   [          Login          ]                    |
|                                                                  |
|                   New user? Register                              |
+------------------------------------------------------------------+
```

- Show authentication validation below or adjacent to the relevant field.
- Registration follows the approved Business Registration workflow:
  Registration → Business Setup → Business Workspace.
- Login does not add social authentication or alternate sign-in methods.
- Use text-based StockPilot branding only.

#### Registration screen

```text
+------------------------------------------------------------------+
| StockPilot                                                       |
|                                                                  |
|                   [ Create your account ]                        |
|                                                                  |
|                   Name                                           |
|                   [________________________________]               |
|                                                                  |
|                   Email                                          |
|                   [________________________________]               |
|                                                                  |
|                   Password                                       |
|                   [________________________________]               |
|                                                                  |
|                   [        Register        ]                      |
|                                                                  |
|                   Already have an account? Login                  |
+------------------------------------------------------------------+
```

- Keep registration fields limited to the approved authentication requirements.
- After successful registration, continue to Business Setup.

### 7.2 Business Workspace Setup

#### Business setup screen

```text
+------------------------------------------------------------------+
| StockPilot                         Step 1 of 1                    |
+------------------------------------------------------------------+
|                                                                  |
| [ Business Setup ]                                               |
| Complete the workspace information for your business.            |
|                                                                  |
| Business name [_______________________________________________]   |
|                                                                  |
| Business category [___________________________________________]   |
|                                                                  |
| Contact email [_______________________________________________]   |
| Contact phone [_______________________________________________]   |
|                                                                  |
| Location [____________________________________________________]   |
| Currency [ INR - Indian Rupee (₹) ]                              |
|                                                                  |
|                         [ Cancel ] [ Create Workspace ]          |
+------------------------------------------------------------------+
```

- Currency defaults to INR (₹).
- The location and currency fields are required business configuration fields.
- Preserve the existing Business Setup → Business Workspace workflow.

#### Workspace selection layout

```text
+------------------------------------------------------------------+
| Text: StockPilot              [Business switcher ▼] [ User menu ] |
+--------------------------+---------------------------------------+
| Current workspace cards  |                                       |
| [ Owner One Store      ] |  Workspace overview                   |
| [ Owner Two Store      ] |  Selected business name               |
|                          |  Location                             |
+--------------------------+---------------------------------------+
```

- A user may select a workspace only when the user has an authorized membership.
- The workspace selector appears in the top navigation for users with multiple business workspaces.
- Role-based navigation and actions must reflect the selected workspace and user's role.

### 7.3 Main Application Shell

#### Desktop layout

```text
+------------------------------------------------------------------+
| Fixed Top Navigation                                             |
| [StockPilot] [Workspace switcher] [Search] [Alerts] [User]       |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Main Content Area                         |
| Dashboard            | [ Page title ]             [ Primary ]   |
| Inventory            |                                           |
|  - Products          | [ KPI cards / content ]                   |
|  - Categories        |                                           |
|  - Warehouses        | [ Charts / tables / actions ]             |
|  - Stock Movements   |                                           |
| Operations           |                                           |
| Intelligence         |                                           |
| Administration       |                                           |
+----------------------+-------------------------------------------+
```

#### Tablet layout

```text
+------------------------------------------------------------------+
| [Menu] StockPilot [Workspace] [Search] [Alerts] [User]            |
+------------------------------------------------------------------+
| Main Content Area                                                 |
| [ Page title ]                                  [Primary action] |
| [ KPI cards in 2 columns ]                                        |
| [ Charts and tables ]                                             |
+------------------------------------------------------------------+
```

- On Tablet, the sidebar becomes collapsible.
- Role-based navigation remains available from the sidebar menu.

#### Mobile layout

```text
+------------------------------------+
| [Menu] StockPilot       [Alerts]   |
| [Workspace]                        |
+------------------------------------+
| [ Page title ]                     |
| [ Primary action ]                 |
| [ KPI card ]                       |
| [ KPI card ]                       |
| [ Main content ]                   |
+------------------------------------+
```

- On Mobile, navigation becomes a slide-out menu.
- Tables remain readable with comfortable rows and move to horizontal scrolling or prioritized summary fields.
- Primary actions remain visible and are not hidden behind nested menus unless constrained by space.

### 7.4 Business Dashboard

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store] [Search] [Alerts] [Notifications] |
+----------------------+-------------------------------------------+
| Sidebar              | Business Dashboard                        |
| Dashboard            | Overview | Period: [This Month ▼]         |
| Inventory            |                                           |
| Operations           | +-----------+ +-----------+ +-----------+ |
| Intelligence         | | Total     | | Inventory | | Total     | |
| Administration       | | Products  | | Value     | | Sales     | |
|                      | | 120       | | ₹1.25L    | | ₹2.40L    | |
|                      | +-----------+ +-----------+ +-----------+ |
|                      |                                           |
|                      | +-----------+ +-----------+ +-----------+ |
|                      | | Purchase  | | Est. Gross| | Low Stock | |
|                      | | Value     | | Profit    | | Products  | |
|                      | | ₹90,000   | | ₹60,000   | | 8         | |
|                      | +-----------+ +-----------+ +-----------+ |
|                      |                                           |
|                      | +-----------+ +-----------+ +-----------+ |
|                      | | Out of    | | Pending   | |           | |
|                      | | Stock     | | Purchases | |           | |
|                      | | 3         | | 4         | |           | |
|                      | +-----------+ +-----------+ +-----------+ |
|                      |                                           |
|                      | [ Sales Trend Chart ]                     |
|                      |                                           |
|                      | [ Top-Selling Products Table ]            |
|                      | Product | Sold Qty | Sales Amount          |
|                      | [comfortable readable rows]               |
+------------------------------------------------------------------+
```

#### Dashboard sections

- KPI cards: Total Products, Total Inventory Value, Total Sales, Purchase Value,
  Estimated Gross Profit, Low Stock Products, Out of Stock Products and
  Pending Purchase Orders.
- Sales trends chart for the selected period.
- Top-selling products table.
- Currency values use INR (₹).
- Dashboard dates use DD/MM/YYYY where date context is displayed.
- Low-stock and out-of-stock cards remain visually distinct.
- Cards and table rows link to the relevant approved module or report.

### 7.5 Product Management

#### Product Listing Screen

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Products                                   |
| Dashboard            |                                          [Add] |
| Inventory            |                                           |
|  - Products          | [Search products...] [Category ▼]              |
|  - Categories        | [Import Excel/CSV]                       |
|  - Warehouses        |                                           |
|  - Stock Movements   | +-----------------------------------------+ |
| Operations           | | Comfortable Product Table               | |
| Intelligence         | |                                         | |
| Administration       | | Product | SKU | Category | Stock | Actions |
|                      | | --------|-----|----------|-------|--------- |
|                      | | Product | SKU | Category | Stock | View    |
|                      | | Product | SKU | Category | Stock | Edit    |
|                      | | Product | SKU | Category | Stock | Delete  |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- The listing shows product name, SKU, category and current stock.
- Use the comfortable table layout approved for the application.
- Add category filtering in the existing product listing workflow.
- Provide row actions for view, edit and delete.
- Display purchase and selling prices in the product details or edit flow.
- Currency values use INR (₹).
- Table rows remain readable on Desktop and Tablet.
- On Mobile, prioritize product name, SKU and stock, with secondary fields available through the product details screen.
- The Add and Excel/CSV Import actions remain visible at the page heading.

#### Add Product Screen

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Add Product                                                      |
|                                                                  |
| Product name * [_____________________________________________]    |
| SKU *          [_____________________________________________]    |
| Barcode        [_____________________________________________]    |
|                                                                  |
| Category *     [ Select category ▼ ]                             |
| Brand          [_____________________________________________]    |
| Supplier       [ Select supplier ▼ ]                             |
|                                                                  |
| Purchase price [₹________________]                               |
| Selling price  [₹________________]                               |
|                                                                  |
| Stock is managed through the Inventory workflow.                   |
| Minimum stock threshold [__________]                             |
|                                                                  |
| Product description                                              |
| [____________________________________________________________]   |
| [____________________________________________________________]   |
|                                                                  |
| Product image                                                    |
| [ Choose image ]  [No file selected]                             |
|                                                                  |
|                              [ Cancel ] [ Save Product ]         |
+------------------------------------------------------------------+
```

- Product name, SKU and category are required.
- Purchase price and selling price are validated as non-negative values.
- Current stock is displayed and handled according to the existing inventory workflow.
- Minimum stock threshold is optional when it is not supplied.
- Supplier is optional until a supplier workflow is implemented.
- The product image field supports the specification's product-image requirement.
- Use inline validation and clear save/failure feedback.

#### Edit Product Screen

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Edit Product                                                     |
|                                                                  |
| Product name * [ Test Phone _________________________________]   |
| SKU *          [ PHONE-001 __________________________________]   |
| Barcode        [ 8901234567890 _____________________________]   |
|                                                                  |
| Category *     [ Electronics ▼ ]                                  |
| Brand          [ Test Brand _________________________________]   |
| Supplier       [ Select supplier ▼ ]                             |
|                                                                  |
| Purchase price [₹100]                                            |
| Selling price  [₹150]                                            |
|                                                                  |
| Current stock  [12]                                              |
| Minimum stock threshold [5]                                      |
|                                                                  |
| Product description                                              |
| [____________________________________________________________]   |
|                                                                  |
| Product image                                                    |
| [ Existing image preview ] [ Replace image ]                     |
|                                                                  |
|                              [ Cancel ] [ Update Product ]       |
+------------------------------------------------------------------+
```

- Pre-fill all existing product values.
- SKU and category validation remain required.
- Current stock is treated as inventory state and is not edited as an unauthorized direct stock adjustment.
- Preserve the existing product update workflow.
- Use the same validation, feedback and layout conventions as Add Product.

#### Product Details Screen

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Product Details            [Edit] [Delete] |
| Dashboard            |                                           |
| Inventory            | [ Product image ]                         |
|  - Products          |                                           |
|                      | Product name                              |
|                      | SKU: PHONE-001                            |
|                      | Barcode: 8901234567890                    |
|                      | Category: Electronics                     |
|                      | Brand: Test Brand                         |
|                      | Supplier: [Supplier name]                  |
|                      |                                           |
|                      | Purchase price: ₹100                      |
|                      | Selling price: ₹150                       |
|                      | Current stock: 12                         |
|                      | Minimum stock threshold: 5                |
|                      |                                           |
|                      | Product description                       |
|                      | [____________________________________]    |
|                      |                                           |
+----------------------+-------------------------------------------+
```

- Product details remain read-focused apart from authorized Edit and Delete actions.
- Delete requires confirmation and must not remove records that violate existing data dependencies.
- Current stock is informational in this screen and links to the inventory module when available.
- Display product image when available and an empty state when unavailable.

#### Excel/CSV Import Screen

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Import Products                                                  |
|                                                                  |
| Upload Excel or CSV file                                         |
| [ Choose file ]  [No file selected]                              |
| Supported formats: XLSX, XLS, CSV                                |
|                                                                  |
| Required columns                                                 |
| productName | sku | category | purchasePrice | sellingPrice      |
|                                                                  |
| Optional columns                                                 |
| barcode | brand | openingStock | minimumStockThreshold |          |
| supplier | productDescription | productImage                     |
|                                                                  |
| [ Download sample template ]                                     |
|                                                                  |
| Import summary                                                    |
| Total rows: 0  Imported: 0  Failed: 0                            |
|                                                                  |
|                              [ Cancel ] [ Start Import ]         |
+------------------------------------------------------------------+
```

- Support the existing Excel/CSV product import workflow.
- Identify required and optional fields using the specification and import conventions.
- Show row-level import errors in the import summary.
- Opening stock must be handled through an auditable inventory movement.
- Use existing duplicate-SKU and category-ownership validation feedback.
- Currency values use INR (₹) where purchase and selling prices are shown.
- The import screen remains within Product Management and does not introduce purchase or advanced inventory workflows.

### 7.6 Supplier Management

#### Supplier Listing Screen

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Suppliers                    [Add Supplier] |
| Dashboard            |                                           |
| Inventory            | [Search suppliers...]                     |
| Operations           |                                           |
|  - Suppliers         | +-----------------------------------------+ |
|  - Purchases         | | Comfortable Supplier Table              | |
|  - Customers         | |                                         | |
|  - Sales             | | Supplier Name | Contact Person | Email | Phone | Actions |
|  - Invoices          | |---------------|----------------|-------|-------|---------|
| Intelligence         | | Supplier Name | Contact Person | Email | Phone | View    |
| Administration       | | Supplier Name | Contact Person | Email | Phone | Edit    |
|                      | | Supplier Name | Contact Person | Email | Phone | Delete  |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- The listing shows supplier name, contact person, email and phone.
- Use the comfortable table layout approved for the application.
- Search suppliers by supplier name or contact person.
- Provide row actions for View, Edit and Delete.
- Supplier actions remain restricted by the logged-in user's role and business membership.
- On Mobile, prioritize supplier name and contact person, with email and phone available through the Supplier Details screen.

#### Add Supplier Screen

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Add Supplier                                                     |
|                                                                  |
| Supplier name * [_____________________________________________]  |
| Company name   [_____________________________________________]  |
|                                                                  |
| Contact person [_____________________________________________]  |
| Email          [_____________________________________________]  |
| Phone          [_____________________________________________]  |
|                                                                  |
| Address                                                           |
| [____________________________________________________________]  |
| [____________________________________________________________]  |
|                                                                  |
| Tax identification [_________________________________________]  |
| Payment terms      [_________________________________________]  |
|                                                                  |
|                              [ Cancel ] [ Save Supplier ]        |
+------------------------------------------------------------------+
```

- Supplier name is required.
- Company name, contact person, email, phone, address, tax identification and payment terms are optional unless specifically required by the business.
- Email and phone values use server-side validation according to their field formats.
- Tax identification and payment terms are saved as supplier information.
- Use inline validation and clear save/failure feedback.

#### Edit Supplier Screen

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Edit Supplier                                                    |
|                                                                  |
| Supplier name * [ Existing Supplier Name _____________________]  |
| Company name   [ Existing Company Name ______________________]  |
|                                                                  |
| Contact person [ Existing Contact Person ___________________]  |
| Email          [ existing@supplier.test ____________________]  |
| Phone          [ Existing phone number _____________________]  |
|                                                                  |
| Address                                                           |
| [ Existing supplier address _________________________________]  |
| [____________________________________________________________]  |
|                                                                  |
| Tax identification [ Existing tax identification ___________]  |
| Payment terms      [ Existing payment terms _________________]  |
|                                                                  |
|                              [ Cancel ] [ Update Supplier ]     |
+------------------------------------------------------------------+
```

- Pre-fill all saved supplier information.
- Keep supplier name required.
- Preserve optional fields and their saved values.
- Use the same validation and feedback conventions as the Add Supplier screen.
- Save and Cancel actions remain available in the edit layout.

#### Supplier Details Screen

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Supplier Details        [Edit] [Delete]  |
| Dashboard            |                                           |
| Inventory            | Supplier name                             |
| Operations           | Company name                               |
|  - Suppliers         |                                           |
|  - Purchases         | Contact person                             |
|  - Customers         | Email                                      |
|  - Sales             | Phone                                      |
|  - Invoices          |                                           |
| Intelligence         | Address                                    |
| Administration       | [____________________________________]    |
|                      |                                           |
|                      | Tax identification                         |
|                      | Payment terms                              |
|                      |                                           |
|                      | Associated Products                        |
|                      | [Display-only supplier product associations] |
|                      |                                           |
|                      | Purchase History                           |
|                      | [Display-only purchase history]             |
|                      |                                           |
+----------------------+-------------------------------------------+
```

- Display the saved supplier name and supported supplier information.
- Show authorized Edit and Delete actions.
- Delete requires confirmation and must not remove supplier records that are referenced by existing records.
- Supplier details remain scoped to the selected business workspace.

### 7.7 Customer Management

#### Customer Listing Screen

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Customers                    [Add Customer] |
| Dashboard            |                                           |
| Inventory            | [Search customers...]                     |
| Operations           |                                           |
|  - Suppliers         | +-----------------------------------------+ |
|  - Purchases         | | Comfortable Customer Table              | |
|  - Customers         | |                                         | |
|  - Sales             | | Customer Name | Contact Information | Actions |
|  - Invoices          | |---------------|---------------------|---------|
| Intelligence         | | Customer Name | Email / Phone       | View    |
| Administration       | | Customer Name | Email / Phone       | Edit    |
|                      | | Customer Name | Email / Phone       | Delete  |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- The listing shows customer name and contact information.
- Use the comfortable table layout approved for the application.
- Search customers by customer name or contact information.
- Provide pagination and row actions for View, Edit and Delete.
- Customer actions remain restricted by the logged-in user's role and business membership.
- On Mobile, prioritize customer name, with email or phone available through the Customer Details screen.

#### Add Customer Screen

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Add Customer                                                     |
|                                                                  |
| Customer name * [_____________________________________________]  |
| Email          [_____________________________________________]  |
| Phone          [_____________________________________________]  |
|                                                                  |
| Address                                                           |
| [____________________________________________________________]  |
| [____________________________________________________________]  |
|                                                                  |
|                              [ Cancel ] [ Save Customer ]       |
+------------------------------------------------------------------+
```

- Customer name is required.
- Email and phone are optional customer contact fields.
- Address is optional.
- Email and phone values use server-side validation according to their field formats.
- Use inline validation and clear save/failure feedback.

#### Edit Customer Screen

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Edit Customer                                                    |
|                                                                  |
| Customer name * [ Existing Customer Name ____________________]  |
| Email          [ existing@customer.test ____________________]  |
| Phone          [ Existing phone number _____________________]  |
|                                                                  |
| Address                                                           |
| [ Existing customer address _________________________________]  |
| [____________________________________________________________]  |
|                                                                  |
|                              [ Cancel ] [ Update Customer ]     |
+------------------------------------------------------------------+
```

- Pre-fill all saved customer information.
- Keep customer name required.
- Preserve optional email, phone and address values.
- Use the same validation and feedback conventions as the Add Customer screen.
- Save and Cancel actions remain available in the edit layout.

#### Customer Details Screen

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Customer Details        [Edit] [Delete]  |
| Dashboard            |                                           |
| Inventory            | Customer name                             |
| Operations           | Email                                      |
|  - Suppliers         | Phone                                      |
|  - Purchases         |                                           |
|  - Customers         | Address                                    |
|  - Sales             | [____________________________________]    |
|  - Invoices          |                                           |
| Intelligence         | Sales-Order History                        |
| Administration       | [Display-only future Sales Management data] |
|                      |                                           |
+----------------------+-------------------------------------------+
```

- Display the saved customer name, email, phone and address.
- Show authorized Edit and Delete actions.
- Display Customer sales-order history as a display-only section for the future Sales Management module.
- Do not add sales creation or sales-record actions in this screen.
- Delete requires a standard confirmation dialog.
- Customer details remain scoped to the selected business workspace.

### 7.8 Purchase Management

#### Purchase Listing

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Purchases                    [Create Purchase] |
| Dashboard            |                                           |
| Inventory            | [Search purchase...] [Supplier ▼] [Status / Approval ▼] |
| Operations           | [Date: DD/MM/YYYY - DD/MM/YYYY]            |
|  - Suppliers         |                                           |
|  - Purchases         | +-----------------------------------------+ |
|  - Customers         | | Comfortable Purchase Table               | |
|  - Sales             | |                                         | |
|  - Invoices          | | PO Number | Supplier | Date | Total | Status / Approval | Actions |
| Intelligence         | |-----------|----------|------|-------|------------------|---------|
| Administration       | | PO Number | Supplier | Date | ₹0.00 | Draft            | View    |
|                      | | PO Number | Supplier | Date | ₹0.00 | Pending Approval | View    |
|                      | | PO Number | Supplier | Date | ₹0.00 | Approved         | View    |
|                      | | PO Number | Supplier | Date | ₹0.00 | Partially Received | View |
|                      | | PO Number | Supplier | Date | ₹0.00 | Received         | View    |
|                      | | PO Number | Supplier | Date | ₹0.00 | Cancelled        | View    |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- The listing shows purchase order number, supplier, purchase date, total amount and status or approval state.
- Search and pagination remain available.
- Supplier and status filters follow the approved purchase workflow.
- Available status and approval values are Draft, Pending Approval, Approved, Partially Received, Received and Cancelled.
- Date filters use DD/MM/YYYY.
- Currency values use INR (₹).
- View is available for purchase details.
- No established Edit action is shown because purchase editing behavior is not clearly defined by the original specification.

#### Create Purchase

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Create Purchase                                                  |
|                                                                  |
| Purchase order number [____________________________________]      |
| Supplier *             [ Select supplier ▼ ]                     |
| Expected delivery date [ DD/MM/YYYY ]                            |
|                                                                  |
| Purchased products                                               |
| +--------------------------------------------------------------+ |
| | Product [Select product ▼] | Quantity | Add item | Remove |  |
| +--------------------------------------------------------------+ |
| | Product [Select product ▼] | Quantity | Add item | Remove |  |
| +--------------------------------------------------------------+ |
|                                                                  |
| Subtotal: ₹0.00                                                  |
| Tax:      ₹0.00                                                  |
| Total:    ₹0.00                                                  |
|                                                                  |
|                              [ Cancel ] [ Create Purchase ]     |
+------------------------------------------------------------------+
```

- Purchase order number, supplier and product quantities are purchase-order information supported by the specification.
- At least one supplier and at least one purchased product are required.
- Product quantities must be valid and non-negative.
- Subtotal, tax and total are calculated from purchase items.
- Tax and total values use INR (₹).
- Approval, supplier payment and purchase payment controls are not shown because the original specification does not define dedicated UI fields or workflows for these actions.
- Received goods and damaged or missing goods are handled in the Goods Receipt workflow, not as fields in Create Purchase.

#### Purchase Details

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Purchase Details           [Goods Receipt] |
| Dashboard            |                                           |
| Inventory            | Purchase order number                     |
| Operations           | Supplier                                  |
|  - Suppliers         | Expected delivery date: DD/MM/YYYY        |
|  - Purchases         | Status / Approval: [Exact purchase status] |
|  - Customers         |                                           |
|  - Sales             | Purchased products                         |
|  - Invoices          | Product | Quantity | Amount                |
| Intelligence         |                                           |
| Administration       | Subtotal: ₹0.00                            |
|                      | Tax: ₹0.00                                |
|                      | Total: ₹0.00                              |
|                      |                                           |
+----------------------+-------------------------------------------+
```

- Display purchase order number, supplier, expected delivery date, status or approval state and purchased products.
- The approval state is represented only by the exact purchase status values listed above.
- Display subtotal, tax and total in INR (₹).
- Purchase editing is not presented as an established feature because the original specification does not define editability behavior.
- A Goods Receipt action is relevant only for the approved purchase receiving workflow and must not assume approval roles or extra approval steps.

#### Goods Receipt

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Cancel]          |
+------------------------------------------------------------------+
| Goods Receipt                                                    |
|                                                                  |
| Purchase order: [Existing purchase order number]                 |
| Supplier: [Existing supplier]                                    |
| Warehouse: [Existing warehouse]                                  |
|                                                                  |
| Purchased product lines                                          |
+--------------------------------------------------------------+ |
| Product | Ordered quantity | Received quantity | Damaged | Missing |
+--------------------------------------------------------------+ |
| Product | Ordered quantity | [Received]        | [Qty]   | [Qty]   |
+--------------------------------------------------------------+ |
|                                                                  |
| Discrepancies                                                    |
| [____________________________________________________________]  |
|                                                                  |
| [ Confirm Goods Receipt ]                                        |
| Inventory updates only confirmed received quantities.            |
+------------------------------------------------------------------+
```

- Display the purchase order and its purchased product lines.
- Verify received quantities against ordered quantities.
- Record damaged goods and missing goods.
- Record discrepancies for the goods receipt.
- Goods receipt confirmation is separate from purchase order creation.
- Inventory stock is updated only for confirmed received quantities.
- Display inventory update confirmation after a confirmed goods receipt.
- No purchase payment or supplier payment controls are included.

#### Purchase History

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Purchase History                          |
| Dashboard            |                                           |
| Inventory            | [Supplier ▼] [Status ▼] [Date range]      |
| Operations           |                                           |
|  - Suppliers         | +-----------------------------------------+ |
|  - Purchases         | | Purchase History Table                   | |
|  - Customers         | |                                         | |
|  - Sales             | | PO Number | Supplier | Date | Total | Status / Approval |
|  - Invoices          | |-----------|----------|------|-------|------------------|
| Intelligence         | | PO Number | Supplier | Date | ₹0.00 | Status / Approval |
| Administration       | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- Purchase history presents existing purchase records in a readable layout.
- Use supplier, status and date-range filters where supported.
- Status and approval state use the exact purchase statuses listed above.
- Dates use DD/MM/YYYY and totals use INR (₹).
- The Purchase Details screen is the supported drill-down destination.
- No purchase editing, payment, reconciliation or approval-role workflow is added.

#### Purchase Management Limitations

- The original specification defines purchase approval and goods receipt workflows but does not define exact approval roles or permission rules.
- Purchase editing behavior is not clearly defined, so no Edit Purchase screen or established Edit action is documented.
- Goods Receipt fields are limited to purchase order, supplier, warehouse, received products, damaged products, discrepancies and receiving information supported by the database design.
- Supplier payment handling is described only where supported and is not included.

### 7.9 Inventory Management

#### Current Stock Listing

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Current Stock                            |
| Dashboard            |                                           |
| Inventory            | [Search product...] [Product ▼] [Warehouse ▼] |
|  - Products          |                                           |
|  - Current Stock     | +-----------------------------------------+ |
|  - Stock Movements   | | Comfortable Stock Table                  | |
|  - Warehouses        | |                                         | |
|  - Stock Alerts      | | Product | Warehouse | Available | Reserved | Minimum |
| Operations           | |---------|-----------|-----------|----------|---------|
| Intelligence         | | Product | Warehouse | Quantity  | Quantity | Threshold |
| Administration       | | Product | Warehouse | Quantity  | Quantity | Threshold |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- Display product, warehouse, available quantity, reserved quantity and minimum-stock threshold.
- Search, product filtering and warehouse filtering remain available.
- Sorting applies to supported stock fields.
- Pagination remains available.
- Low or missing minimum-stock context is shown as a stock alert indicator.
- Current stock and movement access remain restricted to authorized business users and roles.
- Business Owners and Inventory Managers may manage inventory operations defined by the specification.
- Operation-specific role permissions beyond these responsibilities are unspecified.

#### Stock In

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Stock In                                                         |
|                                                                  |
| Product * [ Select product ▼ ]                                    |
| Warehouse [ Select warehouse ▼ ]                                  |
| Quantity * [________]                                             |
| Reference type [__________________________________________]       |
| Reference ID [___________________________________________]       |
|                                                                  |
| [ Validate stock in ]                                             |
|                                                                  |
| Validation: Quantity must be valid and non-negative.             |
| Confirmation: Stock in will create a Stock In inventory movement.|
|                                                                  |
|                              [ Cancel ] [ Confirm Stock In ]     |
+------------------------------------------------------------------+
```

- Record stock received through a stock-in operation.
- Include product, quantity and reference type/reference ID context.
- Warehouse is included where the stock operation is warehouse-specific.
- Validate the product, quantity and business workspace before confirmation.
- Confirming a stock change creates an auditable inventory movement.
- Unauthorized stock changes are blocked.

#### Stock Out

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Stock Out                                                        |
|                                                                  |
| Product * [ Select product ▼ ]                                    |
| Warehouse [ Select warehouse ▼ ]                                  |
| Quantity * [________]                                             |
| Reference type [__________________________________________]       |
| Reference ID [___________________________________________]       |
|                                                                  |
| Available quantity: [0]                                           |
|                                                                  |
| [ Validate stock out ]                                            |
|                                                                  |
| Insufficient-stock validation: quantity cannot exceed stock.     |
| Confirmation: Stock out will create a Stock Out inventory movement.|
|                                                                  |
|                              [ Cancel ] [ Confirm Stock Out ]    |
+------------------------------------------------------------------+
```

- Record stock removed through a stock-out operation.
- Include product, quantity and reference type/reference ID context.
- Warehouse is included where the stock operation is warehouse-specific.
- Validate that quantity does not exceed available stock.
- Confirming a stock change creates an auditable inventory movement.
- Unauthorized stock changes and negative stock balances are blocked.

#### Stock Adjustment

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Stock Adjustment                                                 |
|                                                                  |
| Product * [ Select product ▼ ]                                    |
| Warehouse [ Select warehouse ▼ ]                                  |
| Adjustment quantity * [________]                                  |
| Reference type [__________________________________________]       |
| Reference ID [___________________________________________]       |
|                                                                  |
| Previous quantity: [0]                                           |
| New quantity preview: [0]                                         |
|                                                                  |
| [ Confirm Adjustment ]                                            |
| This operation creates a Stock Adjustment inventory movement.    |
+------------------------------------------------------------------+
```

- Adjustment quantity and preview remain explicit before confirmation.
- Reference information is included only for supported movement references.
- The operation creates an auditable Stock Adjustment inventory movement.
- The movement records previous and new quantity values.
- Unauthorized adjustments are blocked.

#### Stock Movement History

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Stock Movement History                   |
| Dashboard            |                                           |
| Inventory            | [Product ▼] [Warehouse ▼] [Movement Type ▼] |
|  - Stock Movements   | [Date: DD/MM/YYYY - DD/MM/YYYY]            |
|  - Stock Alerts      |                                           |
| Operations           | +-----------------------------------------+ |
| Intelligence         | | Date | Product | Warehouse | Type | Qty | Reference | Previous | New |
| Administration       | |------|---------|-----------|------|-----|-----------|----------|-----|
|                      | | DD/MM/YYYY | Product | Warehouse | Type | Qty | Reference | Previous | New |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- Display movement type, quantity, reference type, reference ID, previous quantity and new quantity.
- Filter by product, warehouse, movement type and date range where supported.
- Movement history remains read-only and business-scoped.
- Movement entries show when the balance changed and which user performed it where the data is available.

#### Stock Alerts

#### Stock Alerts Listing

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Stock Alerts                             |
| Dashboard            |                                           |
| Inventory            | [Search product...] [Low Stock] [Out of Stock] |
|  - Stock Alerts      | [SKU] [Warehouse]                         |
| Operations           |                                           |
| Intelligence         | +-----------------------------------------+ |
| Administration       | | Product | SKU | Available | Minimum | Severity |
|                      | |---------|-----|-----------|---------|----------|
|                      | | Product | SKU | 3         | 10      | [Low]    |
|                      | | Product | SKU | 0         | 5       | [Out]    |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- Display low-stock and out-of-stock products in the selected business workspace.
- Show product name, SKU, available stock and configured minimum-stock threshold where supported.
- Use distinct warning and critical severity indicators.
- Search and filter the alert list by product and warehouse where supported.
- No alert-generation timing or delivery guarantee is specified.

#### Low Stock Alert Details

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Low Stock Alert                                                  |
|                                                                  |
| Product: [Product name]                                          |
| SKU: [SKU]                                                       |
| Available stock: [0 or higher below minimum]                     |
| Minimum-stock threshold: [Configured threshold]                  |
| Severity: Low Stock                                              |
|                                                                  |
| Reorder recommendation                                           |
| [Recommended reorder quantity, if available]                     |
|                                                                  |
|                    [ Close ] [ Create Purchase Order ]          |
+------------------------------------------------------------------+
```

- Show the affected product and current available stock.
- Display the configured minimum-stock threshold.
- Clearly identify the alert as low stock rather than out of stock.
- Display a reorder recommendation when available.
- A business owner may review the recommendation and open the existing Purchase Order workflow.
- No automatic purchase-order creation or approval workflow is included.

#### Out of Stock Alerts

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Out of Stock Alert                                               |
|                                                                  |
| Product: [Product name]                                          |
| SKU: [SKU]                                                       |
| Available stock: 0                                               |
| Minimum-stock threshold: [Configured threshold]                  |
| Severity: Out of Stock                                           |
|                                                                  |
| Reorder recommendation                                           |
| [Recommended reorder quantity, if available]                     |
|                                                                  |
|                    [ Close ] [ Create Purchase Order ]          |
+------------------------------------------------------------------+
```

- Display products whose available stock has reached zero.
- Distinguish this view from low-stock alerts through its critical severity and zero-stock context.
- Display the configured minimum-stock threshold where available.
- Show a reorder recommendation when available.
- A business owner may review the recommendation and create a purchase order manually.

#### Reorder Recommendation Display

```text
+------------------------------------------------------------------+
| Stock Alert - Reorder Recommendation                             |
|                                                                  |
| Product: [Product name]                                          |
| SKU: [SKU]                                                       |
| Available stock: [Quantity]                                      |
| Minimum-stock threshold: [Threshold]                             |
| Recommended reorder quantity: [Quantity, when available]         |
|                                                                  |
| [ Create Purchase Order ]                                        |
+------------------------------------------------------------------+
```

- The reorder recommendation is associated with the affected stock alert.
- Exact forecast and reorder calculation behavior is provided by the demand forecasting workflow.
- The business owner may review and create a purchase order manually.
- The screen does not place or approve purchase orders automatically.

#### Notification List and Read State

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Notifications                        |
| Dashboard            |                                           |
| Inventory            | [All] [Low Stock] [Out of Stock] [Reorder] |
|  - Stock Alerts      |                                           |
| Operations           | [Unread] Low-stock notification           |
| Intelligence         | [Read] Out-of-stock notification          |
| Administration       | [Unread] Reorder recommendation notification|
|                      |                                           |
+----------------------+-------------------------------------------+
```

- Display low-stock, out-of-stock and reorder recommendation notifications where supported.
- Show unread and read state for each notification.
- Notifications remain scoped to the selected business workspace.
- Alert-generation timing and notification delivery guarantees are unspecified.

#### Stock Notification Preferences

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Stock Notification Preferences                                   |
|                                                                  |
| Low-stock notifications [ Enabled / Disabled ]                   |
| Out-of-stock notifications [ Enabled / Disabled ]                |
| Optional email notifications [ Enabled / Disabled ]              |
|                                                                  |
|                              [ Cancel ] [ Save Preferences ]    |
+------------------------------------------------------------------+
```

- Preserve the existing low-stock and out-of-stock preference settings.
- Document optional email notification preference when configured.
- Exact email address storage, delivery timing and delivery guarantee are unspecified.
- No SMS, push notification or additional delivery channel is included.

#### Stock Transfer

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Stock Transfer                                                   |
|                                                                  |
| Product * [ Select product ▼ ]                                    |
| Quantity * [________]                                             |
| Warehouse context [ Display source/destination details if supported ] |
|                                                                  |
| Warehouse transfer fields beyond the original specification are unspecified. |
| Validation and confirmation remain required.                     |
| Confirming creates a Stock Transfer inventory movement.          |
+------------------------------------------------------------------+
```

- Stock Transfer uses the specification movement type and warehouse context.
- Exact source, destination and quantity validation fields are not specified.
- A stock transfer creates an auditable inventory movement.
- No transfer approval step or unsupported transfer status is shown.

#### Damaged Stock

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Damaged Stock                                                    |
|                                                                  |
| Product * [ Select product ▼ ]                                    |
| Warehouse [ Select warehouse ▼ ]                                  |
| Damaged quantity * [________]                                     |
| Reference type [__________________________________________]       |
| Reference ID [___________________________________________]       |
|                                                                  |
| [ Confirm Damaged Stock ]                                         |
| This operation creates a Damaged Stock inventory movement.       |
+------------------------------------------------------------------+
```

- Record damaged stock only for an existing business product and authorized warehouse operation.
- Validate available quantity before confirmation.
- Confirming creates a Damaged Stock inventory movement.
- Purchase goods-received damaged quantities remain handled through Goods Receipt; this screen does not add a separate purchase workflow.

#### Returned Stock

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Returned Stock                                                   |
|                                                                  |
| Product * [ Select product ▼ ]                                    |
| Warehouse [ Select warehouse ▼ ]                                  |
| Returned quantity * [________]                                    |
| Reference type [__________________________________________]       |
| Reference ID [___________________________________________]       |
|                                                                  |
| [ Confirm Returned Stock ]                                        |
| This operation creates a Returned Stock inventory movement.      |
+------------------------------------------------------------------+
```

- Record returned stock for an existing business product and authorized warehouse operation.
- Include product, quantity, reference type and reference ID context.
- Confirming creates an auditable Returned Stock inventory movement.
- No customer return approval or refund workflow is included.

#### Inventory Management Limitations

- Exact inventory API fields for individual stock operations are not fully specified here.
- Operation-specific role/status permissions for individual stock operations are unspecified.
- Business Owners may manage products and monitor purchases and sales; Inventory Managers may manage products, stock movements, purchases and warehouses.
- No additional inventory role permissions are defined by the original specification.
- The original specification does not define a separate warehouse balance edit behavior beyond inventory balances.
- Simultaneous sale and stock operations must be transaction-safe and prevent overselling, but no exact UI lock or reservation workflow is specified.
- Stock transfer UI does not add approval, transfer status or inter-warehouse delivery fields not defined by the specification.
- Exact stock transfer source/destination warehouse fields are unspecified.

### 7.10 Warehouse Management

#### Warehouse Listing

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Warehouses                   [Add Warehouse] |
| Dashboard            |                                           |
| Inventory            | [Search warehouses...]                    |
|  - Warehouses        |                                           |
| Operations           | +-----------------------------------------+ |
| Intelligence         | | Comfortable Warehouse Table              | |
| Administration       | |                                         | |
|                      | | Warehouse | Address | City | Contact | Actions |
|                      | |-----------|---------|------|---------|---------|
|                      | | Warehouse | Address | City | Contact | View |
|                      | | Warehouse | Address | City | Contact | Edit |
|                      | | Warehouse | Address | City | Contact | Delete |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- Display warehouses belonging to the selected business workspace.
- The listing shows warehouse name, address, city and contact number.
- Search, sorting and pagination are available where supported.
- View, Edit and Delete actions are shown only for authorized users.
- Warehouse Delete is not shown when the warehouse is referenced by existing records.
- Warehouse records remain isolated to the selected business workspace.

#### Add Warehouse

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Add Warehouse                                                    |
|                                                                  |
| Warehouse name * [_____________________________________________]  |
| Address *        [_____________________________________________]  |
| City *           [_____________________________________________]  |
| Contact number * [_____________________________________________]  |
|                                                                  |
|                              [ Cancel ] [ Save Warehouse ]      |
+------------------------------------------------------------------+
```

- Warehouse name, address, city and contact number are required by the existing Warehouse model/API.
- Validate all required fields before saving.
- Show clear inline validation and save/failure feedback.
- Creation is available only to authorized business users for the selected workspace.

#### Edit Warehouse

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Edit Warehouse                                                   |
|                                                                  |
| Warehouse name * [ Existing warehouse name ___________________]  |
| Address *        [ Existing address __________________________]  |
| City *           [ Existing city _____________________________]  |
| Contact number * [ Existing contact number __________________]  |
|                                                                  |
|                              [ Cancel ] [ Update Warehouse ]    |
+------------------------------------------------------------------+
```

- Pre-fill the warehouse name, address, city and contact number.
- Use the same required-field validation rules as Add Warehouse.
- Save and Cancel actions remain available only for authorized users.

#### Warehouse Details

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Warehouse Details       [Edit] [Delete] |
| Dashboard            |                                           |
| Inventory            | Warehouse name                            |
|  - Warehouses        | Address                                   |
|  - Stock Movements   | City                                      |
|  - Current Stock     | Contact number                            |
| Operations           |                                           |
| Intelligence         |                                           |
| Administration       |                                           |
+----------------------+-------------------------------------------+
```

- Display the saved warehouse name, address, city and contact number.
- Show authorized Edit and Delete actions.
- Warehouse Delete is not shown when existing records reference the warehouse.
- Exact referenced-record and deletion behavior is not specified beyond this existing UI/UX restriction.
- Warehouse details remain scoped to the selected business workspace.

#### Warehouse Selection Context

```text
+------------------------------------------------------------------+
| Inventory filter/context                                         |
| Warehouse [ Select warehouse ▼ ]                                  |
| Selected warehouse: [Warehouse name]                              |
+------------------------------------------------------------------+
```

- Use warehouse context in relevant inventory screens such as Current Stock and stock movement forms.
- The selected warehouse filters or identifies the applicable inventory context.
- Do not introduce warehouse allocation, stock transfer creation or approval behavior through this selector.
- If warehouse context is not supported for a stock operation, it remains unspecified.

#### Warehouse Management Limitations

- The existing Warehouse model/API fields are warehouse name, address, city and contact number.
- Location and managerId appear in the database design but are not established fields in the existing Warehouse API.
- Business Owner and Inventory Manager responsibilities include warehouse and inventory management.
- Operation-specific warehouse permissions beyond those responsibilities are unspecified.
- Warehouse delete dependencies are restricted by existing record references; exact reference types are unspecified.

### 7.11 Sales Management

#### Sales Order Listing

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Sales Orders               [Create Sales Order] |
| Dashboard            |                                           |
| Inventory            | [Search sales orders...] [Status ▼]       |
| Operations           | [Date: DD/MM/YYYY - DD/MM/YYYY]            |
|  - Suppliers         |                                           |
|  - Sales             | +-----------------------------------------+ |
|  - Invoices          | | Comfortable Sales Order Table            | |
|  - Customers         | |                                         | |
| Intelligence         | | Order | Customer | Date | Total | Status | Actions |
| Administration       | |-------|----------|------|-------|--------|---------|
|                      | | Order | Customer | Date | ₹0.00 | Draft  | View    |
|                      | | Order | Customer | Date | ₹0.00 | Confirmed | View |
|                      | | Order | Customer | Date | ₹0.00 | Processing | View |
|                      | | Order | Customer | Date | ₹0.00 | Completed | View |
|                      | | Order | Customer | Date | ₹0.00 | Cancelled | View |
|                      | | Order | Customer | Date | ₹0.00 | Returned | View |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- Display sales order number, customer, date, total amount and status.
- Search and paginate sales orders.
- Filter by Draft, Confirmed, Processing, Completed, Cancelled or Returned.
- Currency values use INR (₹).
- Date values use DD/MM/YYYY.
- Provide authorized View actions for sales order details.
- Sales Employee users may create sales orders subject to business workspace access.

#### Create Sales Order

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Create Sales Order                                               |
|                                                                  |
| Customer                                                         |
| [ Search customer ] [ Existing customer ▼ ]                       |
| Or customer information [___________________________________]    |
|                                                                  |
| Products                                                         |
| [ Search products ]                                              |
| +--------------------------------------------------------------+ |
| | Product | Available stock | Quantity | Unit price | Amount   | |
| +--------------------------------------------------------------+ |
| | Product | Available stock | [Qty]    | ₹0.00     | ₹0.00    | |
| +--------------------------------------------------------------+ |
|                                                                  |
| Discount [Authorized amount or rate]                             |
| Subtotal: ₹0.00                                                  |
| Discount: ₹0.00                                                  |
| Tax: ₹0.00                                                       |
| Total: ₹0.00                                                     |
|                                                                  |
| [ Validate availability ]                                        |
| [ Confirm Order ]                                                |
+------------------------------------------------------------------+
```

- Search and select products.
- Check available stock before adding or confirming products.
- Add product quantities to the order.
- Select an existing customer or enter customer information.
- Apply discounts only when authorized.
- Calculate subtotal, discount, tax and total amount.
- Show an order summary before confirmation.
- Confirm Order changes the transaction to the order-confirmation workflow.
- Confirmed sales deduct confirmed sold quantities from available inventory.
- Stock changes remain transaction-safe and prevent overselling.

#### Sales Order Details

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Sales Order Details      [Confirm] [Cancel] |
| Dashboard            |                                           |
| Inventory            | Sales order number                        |
| Operations           | Customer                                  |
|  - Suppliers         | Order date: DD/MM/YYYY                    |
|  - Sales             | Status: [Exact sales status]              |
|  - Invoices          |                                           |
|  - Customers         | Products                                  |
| Intelligence         | Product | Quantity | Price | Discount | Tax | Amount |
| Administration       |                                           |
|                      | Subtotal: ₹0.00                            |
|                      | Discount: ₹0.00                            |
|                      | Tax: ₹0.00                                 |
|                      | Total: ₹0.00                               |
|                      |                                           |
|                      | [Generate Invoice] (after confirmation)   |
+----------------------+-------------------------------------------+
```

- Display customer and product information.
- Show quantities, unit prices, discounts, taxes and total amount.
- Display order number, date, status and transaction details supported by the specification.
- Relevant authorized actions include confirming or cancelling the order where supported.
- Invoice generation is available after confirming a sales order as the handoff from Sales Management.
- This task documents only the Generate Invoice entry point; complete Invoice Management is not included.
- Confirmed sales inventory deduction occurs through the sales transaction.

#### Sales Order History

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Sales Order History                       |
| Dashboard            |                                           |
| Inventory            | [Search orders...] [Status ▼] [Date range] |
| Operations           |                                           |
|  - Sales             | +-----------------------------------------+ |
|  - Invoices          | | Order | Customer | Date | Total | Status |
|  - Customers         | |-------|----------|------|-------|--------|
| Intelligence         | | Order | Customer | Date | ₹0.00 | Status |
| Administration       | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- Display previous sales orders in a readable table.
- Search by supported order or customer information.
- Filter by the exact sales statuses.
- Use DD/MM/YYYY and INR (₹).
- Provide drill-down access to Sales Order Details.

#### Cancellation and Returns

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Sales Cancellation or Return                                     |
|                                                                  |
| Sales order: [Existing sales order number]                       |
| Customer: [Existing customer]                                    |
| Status: [Draft / Confirmed / Processing / Completed / Cancelled / Returned] |
|                                                                  |
| [Confirm Cancellation]                                           |
| [Confirm Return]                                                 |
|                                                                  |
| Inventory impact                                                  |
| [Confirmed inventory impact only; exact restoration rules unspecified] |
+------------------------------------------------------------------+
```

- Cancellation and return states remain within the specified sales statuses.
- A cancellation or return must be explicitly confirmed before a status change.
- Confirmed cancellation or return inventory impact is shown only where it is defined and transaction-safe.
- Returned Stock may be the supported inventory movement type, but exact return/restoration behavior is unspecified.
- No refund approval, return inspection or additional approval workflow is included.

#### Sales Management Limitations

- Exact cancel/return role permissions and status transition rules are unspecified.
- Exact refund behavior is outside this Sales Management scope.
- Exact inventory restoration behavior for cancelled or returned sales is unspecified.
- Discount type and authorization rules are not defined beyond authorized discounts.
- A separate Invoice Management module is not implemented in this task.

### 7.12 Invoice Management

#### Invoice Listing

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Invoices                                  |
| Dashboard            |                                           |
| Inventory            | [Search invoices...] [Payment Status ▼]   |
| Operations           | [Date: DD/MM/YYYY - DD/MM/YYYY]            |
|  - Suppliers         |                                           |
|  - Sales             | +-----------------------------------------+ |
|  - Invoices          | | Comfortable Invoice Table                | |
|  - Customers         | |                                         | |
| Intelligence         | | Invoice | Date | Customer | Total | Status | Actions |
| Administration       | |---------|------|----------|-------|--------|---------|
|                      | | INV-001 | Date | Customer | ₹0.00 | Paid | View/Print |
|                      | | INV-002 | Date | Customer | ₹0.00 | Unpaid | View/Print |
|                      | | INV-003 | Date | Customer | ₹0.00 | Partially Paid | View/Print |
|                      | | INV-004 | Date | Customer | ₹0.00 | Refunded | View/Print |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- Search invoices by supported invoice or customer information.
- Display invoice number, invoice date, customer, total payable amount and payment status.
- Filter by Paid, Unpaid, Partially Paid or Refunded.
- Provide authorized View and Print/Download actions.
- Use DD/MM/YYYY for invoice dates and INR (₹) for payable amounts.
- Invoice records remain scoped to the selected business workspace.

#### Invoice Details

```text
+------------------------------------------------------------------+
| StockPilot - Text Branding                 [Print] [Download PDF] |
+------------------------------------------------------------------+
| Business name                                                     |
| [Text branding area; final logo unspecified]                      |
|                                                                  |
| Invoice number: [Invoice number]                                  |
| Invoice date: DD/MM/YYYY                                          |
|                                                                  |
| Customer                                                         |
| [Customer name]                                                   |
| [Customer information]                                            |
|                                                                  |
| Product description | Quantity | Unit price | Discount | Tax | Amount |
| ------------------- | -------- | ---------- | -------- | --- | ------ |
| [Description]       | [Qty]    | ₹0.00      | ₹0.00    | ₹0.00 | ₹0.00 |
|                                                                  |
| Subtotal: ₹0.00                                                  |
| Discount: ₹0.00                                                  |
| Tax: ₹0.00                                                       |
| Total payable: ₹0.00                                             |
| Payment status: [Paid / Unpaid / Partially Paid / Refunded]       |
+------------------------------------------------------------------+
```

- Display the business name and text-based branding area.
- Display invoice number, invoice date and customer information.
- Display product description, quantity, unit price, discount, tax and amount.
- Display subtotal, discount, tax and total payable amount.
- Display one of the specified payment statuses.
- Tax values follow the business tax configuration.

#### Invoice Print and Download

```text
+------------------------------------------------------------------+
| Print / Download Preview                                         |
+------------------------------------------------------------------+
| [Text branding / business name]                                   |
| Invoice number and invoice date                                  |
| Customer information                                             |
|                                                                  |
| Product description | Quantity | Unit price | Discount | Tax | Amount |
| ------------------- | -------- | ---------- | -------- | --- | ------ |
| [Description]       | [Qty]    | ₹0.00      | ₹0.00    | ₹0.00 | ₹0.00 |
|                                                                  |
| Subtotal | Discount | Tax | Total payable                        |
| Payment status                                                   |
|                                                                  |
| [Print] [Download PDF]                                           |
+------------------------------------------------------------------+
```

- Present a professional, readable print/download layout.
- Include the business name or text branding, invoice number, invoice date and customer information.
- Include product descriptions, quantities, unit prices, discounts, taxes and totals.
- Support PDF download according to the original Invoice Management requirement.
- Print and download use the same invoice information shown in Invoice Details.

#### Payment Status Display

```text
+------------------------------------------------------------------+
| Invoice Listing and Details                                      |
| [Paid] Green badge                                               |
| [Unpaid] Grey or neutral badge                                   |
| [Partially Paid] Warning badge                                   |
| [Refunded] Neutral or secondary badge                            |
+------------------------------------------------------------------+
```

- Paid, Unpaid, Partially Paid and Refunded are the only specified payment statuses.
- Show payment status as a badge in invoice listing.
- Show payment status in invoice details and print/download views.
- Status display is descriptive only; no payment collection or gateway workflow is included.

#### Invoice Access from Sales

```text
+------------------------------------------------------------------+
| Confirmed Sales Order                                             |
| Sales order number: [Order number]                                |
| Status: Confirmed                                                 |
|                                                                  |
| [Generate Invoice]                                                |
|                                                                  |
| Generated invoice: [Invoice number]                                |
| Relationship: Sales Order -> Invoice                              |
+------------------------------------------------------------------+
```

- Invoice generation follows confirmed sales-order confirmation.
- Generate Invoice is available from the confirmed sales order workflow.
- The generated invoice references the sales order and customer.
- This section documents the Sales-to-Invoice handoff only.
- Complete Invoice Management actions remain in the Invoice Management section.

#### Invoice Management Limitations

- Exact logo storage or upload fields are unspecified; text-based StockPilot branding is used until a final logo is approved.
- Exact payment status transition rules and invoice update permissions are unspecified.
- No payment collection, gateway integration, payment processing or refund-processing workflow is included.
- Tax configuration follows business tax and invoice settings; exact local tax formatting is unspecified.

### 7.13 AI Demand Forecasting

#### Demand Forecasting Overview

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Demand Forecasting                       |
| Dashboard            |                                           |
| Inventory            | [Search product...] [Forecast period ▼]   |
| Intelligence         |                                           |
|  - Forecasting       | +-----------------------------------------+ |
|  - Analytics         | | Forecast Overview                        | |
|  - Reports           | | Product | Historical Sales | Predicted | Reorder |
| Administration       | |---------|-----------------|-----------|---------|
|                      | | Product | Sales context   | Demand    | Quantity |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- Present a product-level forecasting overview for the selected business workspace.
- Show historical sales context for the affected product.
- Display predicted demand and recommended reorder quantity where available.
- Use read-only forecast information; no automatic purchase or model-control action is shown.
- Relevant demand forecasting access remains limited to authorized business users.

#### Product Forecast Selection

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Product Forecast                                                  |
|                                                                  |
| Product * [ Select product ▼ ]                                    |
| Forecast period [ Select supported period ▼ ]                    |
|                                                                  |
| Historical sales context                                         |
| Date | Historical sales quantity                                 |
| DD/MM/YYYY | [Quantity]                                          |
| DD/MM/YYYY | [Quantity]                                          |
|                                                                  |
| [ View Forecast ]                                                |
+------------------------------------------------------------------+
```

- Select a product within the selected business workspace.
- Select a forecast period supported by the forecasting workflow.
- Display relevant historical sales data used for the forecast.
- Exact forecast period formats and supported period values are unspecified.
- No forecasting model selection or training control is included.

#### Forecast Results

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Forecast Results                                                 |
|                                                                  |
| Product: [Product name]                                          |
| Forecast period: [Period]                                        |
|                                                                  |
| [Historical Sales vs Predicted Demand Chart]                     |
| Historical sales | Predicted demand                              |
|                                                                  |
| Predicted demand: [Quantity]                                     |
| Recommended reorder quantity: [Quantity, when available]         |
|                                                                  |
| Model name: [Model name]                                         |
+------------------------------------------------------------------+
```

- Compare historical sales with predicted future demand.
- Display product-level predicted demand.
- Display recommended reorder quantity where available.
- Show model name where stored.
- Reorder recommendations remain review-only; no automatic purchase order is created.

#### Forecast Evaluation

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Forecast Evaluation                                              |
|                                                                  |
| Model name: [Model name]                                         |
| Evaluation status: [Evaluation status]                            |
|                                                                  |
| Evaluation metrics                                               |
| [Supported metric name]: [Metric value]                           |
| [Supported metric name]: [Metric value]                           |
|                                                                  |
| [ Close ]                                                        |
+------------------------------------------------------------------+
```

- Display stored model name and evaluation metrics.
- Display forecast evaluation status when supported.
- Exact evaluation metric names, values and status labels are unspecified.
- No model training, retraining or configuration controls are included.

#### AI Demand Forecasting Limitations

- The original specification defines forecasting workflow and evaluation, but does not define exact chart types, period values or UI labels.
- Exact forecasting algorithms and model names are unspecified.
- Exact evaluation metric names and status values are unspecified.
- Forecast data and reorder recommendations remain read-only in this wireframe scope.
- No automatic purchase order or model retraining workflow is included.

### 7.14 Business Analytics

#### Business Analytics Overview

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Business Analytics                       |
| Dashboard            | Period: [Date range]                      |
| Intelligence         |                                           |
|  - Analytics         | +-----------+ +-----------+ +-----------+ |
|  - Forecasting       | | Total     | | Inventory | | Total     | |
|  - Reports           | | Products  | | Value     | | Sales     | |
| Administration       | | [Qty]     | | ₹0.00     | | ₹0.00     | |
|                      | +-----------+ +-----------+ +-----------+ |
|                      |                                           |
|                      | +-----------+ +-----------+ +-----------+ |
|                      | | Purchase  | | Estimated | | Low Stock | |
|                      | | Value     | | Gross Profit | | Products  | |
|                      | | ₹0.00     | | ₹0.00     | | [Qty]     | |
|                      | +-----------+ +-----------+ +-----------+ |
|                      |                                           |
|                      | +-----------+ +-----------+ +-----------+ |
|                      | | Out of    | | Pending   | |           | |
|                      | | Stock     | | Purchase Orders | |           |
|                      | | [Qty]     | | [Qty]     | |           | |
|                      | +-----------+ +-----------+ +-----------+ |
+------------------------------------------------------------------+
```

- KPI overview contains Total Products, Total Inventory Value, Total Sales, Purchase Value, Estimated Gross Profit, Low Stock Products, Out of Stock Products and Pending Purchase Orders.
- Total Sales represents sales revenue, not profit.
- Purchase Value represents purchase cost, not profit.
- Estimated Gross Profit is shown separately and is not relabeled as net profit.
- No net-profit KPI or unsupported profit formula is shown.
- Loading, empty and no-data states remain available for the overview and charts.

#### Sales Analytics

```text
+------------------------------------------------------------------+
| Business Analytics | Sales Analytics                              |
| Period: [Daily] [Monthly] [Date range]                            |
+------------------------------------------------------------------+
| [Daily / Monthly Sales Trend]                                     |
| Sales revenue                                                    |
|                                                                  |
| Product-wise sales                                               |
| Product | Quantity sold | Sales revenue                           |
|                                                                  |
| Category-wise revenue                                            |
| Category | Sales revenue                                         |
+------------------------------------------------------------------+
```

- Display daily and monthly sales trends.
- Display product-wise sales.
- Display category-wise revenue.
- Period filters are available for supported analytics periods.
- Revenue is labeled as sales revenue and is not presented as profit.
- Exact chart types and calculation formulas are unspecified.

#### Inventory Analytics

```text
+------------------------------------------------------------------+
| Business Analytics | Inventory Analytics                         |
| Warehouse: [All warehouses / Selected warehouse]                  |
+------------------------------------------------------------------+
| [Inventory Distribution]                                          |
| Product / category inventory context                              |
|                                                                  |
| [Inventory Movement Visualization]                               |
| Product or warehouse movement context                             |
+------------------------------------------------------------------+
```

- Display inventory distribution.
- Display inventory movement visualization.
- Warehouse filtering is available where supported.
- Exact chart types and movement aggregation rules are unspecified.
- Empty and no-data states remain available.

#### Purchase Analytics

```text
+------------------------------------------------------------------+
| Business Analytics | Purchase Analytics                          |
| Period: [Date range]                                              |
+------------------------------------------------------------------+
| Purchase trends                                                   |
| [Purchase Value over time]                                        |
|                                                                  |
| Purchase versus sales summary                                     |
| Purchase Value | Sales Revenue                                    |
+------------------------------------------------------------------+
```

- Display purchase trends.
- Display purchase versus sales summary where supported.
- Purchase Value and Sales Revenue remain separately labeled.
- Exact chart types and comparison formulas are unspecified.

#### Product Performance

```text
+------------------------------------------------------------------+
| Business Analytics | Product Performance                         |
| Period: [Date range]                                              |
+------------------------------------------------------------------+
| Top-selling products                                             |
| Product | Quantity sold | Sales revenue                          |
|                                                                  |
| Product-wise sales context                                       |
| [Selected product sales view]                                     |
+------------------------------------------------------------------+
```

- Display top-selling products.
- Display product-wise sales context.
- Product sales are not presented as profit.
- Ranking and period behavior exact values are unspecified.

#### Demand Forecast Visualization

```text
+------------------------------------------------------------------+
| Business Analytics | Demand Forecast                              |
| Product: [Selected product] | Period: [Forecast period]           |
+------------------------------------------------------------------+
| [Historical Sales and Predicted Demand Chart]                     |
| Historical sales | Predicted demand                              |
|                                                                  |
| Reorder recommendation: [Quantity, where available]               |
+------------------------------------------------------------------+
```

- Display the demand forecast in the analytics dashboard.
- Keep this consistent with the separate AI Demand Forecasting screens.
- Show historical sales and predicted demand.
- Show reorder recommendation where available.
- Exact forecast chart type and period values remain unspecified.

#### Business Analytics States

```text
+------------------------------------------------------------------+
| Loading: [Analytics data loading]                                 |
| Empty: [No analytics data available for this period]              |
| No data: [No records match the selected filters]                  |
+------------------------------------------------------------------+
```

- Loading, empty and no-data states apply to analytics KPIs and visualizations.
- Analytics queries remain scoped to the selected business workspace.
- Exact date-period defaults and chart behavior remain unspecified.

#### Business Analytics Limitations

- Exact profit formulas and chart calculations are unspecified.
- Net profit is not a specified KPI in this task.
- Exact chart types, period defaults and comparison formulas are unspecified.
- Warehouse filtering is supported only where inventory analytics have warehouse context.
- Report exports remain outside this analytics wireframe task unless separately documented.

### 7.15 Reports and Exports

#### Reports Overview

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Reports                                  |
| Dashboard            |                                           |
| Intelligence         | [Search reports...]                       |
|  - Analytics         |                                           |
|  - Reports           | +-----------------------------------------+ |
|  - Forecasting       | | Available Reports                        | |
| Administration       | |                                         | |
|                      | | Business Report                         | |
|                      | | Supported business performance report  | |
|                      | |                                         | |
|                      | | Inventory Report                        | |
|                      | | Stock and inventory report             | |
|                      | |                                         | |
|                      | | Financial Report                        | |
|                      | | Sales and purchase financial records   | |
|                      | +-----------------------------------------+ |
+------------------------------------------------------------------+
```

- Show available business reports, inventory reports and financial reports supported by the specification.
- Display report names and only brief descriptions supported by the underlying module.
- Exact report catalog names beyond these approved report groups are unspecified.
- Search and open a report from the report list.

#### Report Filters

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Report Filters                                                   |
|                                                                  |
| Date range [ DD/MM/YYYY - DD/MM/YYYY ]                           |
| Business filter [ Selected business workspace ]                   |
|                                                                  |
| Additional report filters                                        |
| [Only filters supported by the selected report]                   |
|                                                                  |
|                              [ Reset ] [ Apply Filters ]         |
+------------------------------------------------------------------+
```

- Date range selection uses DD/MM/YYYY.
- Apply the selected business workspace as the business filter.
- Show additional filters only for fields supported by the selected report.
- Exact additional report filter names are unspecified.
- Filters do not introduce report scheduling or recurring exports.

#### Report Preview

```text
+------------------------------------------------------------------+
| [Report name]                            [Back] [Export]          |
+------------------------------------------------------------------+
| Filters: [Selected date range and business context]               |
|                                                                  |
| [Report preview table or summary]                                |
|                                                                  |
| [No data: No report records match the selected filters]          |
|                                                                  |
+------------------------------------------------------------------+
```

- Preview the selected report before export.
- Display relevant report data for the approved report category.
- Keep revenue, purchase cost, gross profit and net-profit distinctions intact.
- Label sales revenue as revenue, not profit.
- Show a clear no-data state when no report records match.
- Loading and preview failure states remain available for report generation.

#### Report Export

```text
+------------------------------------------------------------------+
| Export Report                                                    |
|                                                                  |
| Format                                                           |
| [CSV] [Excel] [PDF]                                              |
|                                                                  |
| Selected report: [Report name]                                   |
| Selected date range: DD/MM/YYYY - DD/MM/YYYY                     |
|                                                                  |
| [ Cancel ] [ Export ]                                            |
+------------------------------------------------------------------+
```

- Export actions are available only to authorized report users.
- Supported export formats are CSV, Excel and PDF.
- PDF preserves the readable report preview layout.
- CSV and Excel export the underlying report records.
- No report scheduling, automated email delivery or recurring export workflow is included.

#### Reports and Exports Limitations

- Exact report category names and report descriptions beyond business, inventory and financial reports are unspecified.
- Exact report fields, calculations and additional filters depend on the selected report and are unspecified.
- PDF, CSV and Excel are the approved export formats for this wireframe scope.
- No report scheduling or automated export delivery is specified.

### 7.16 Employee Management

#### Employee List

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Employees               [Invite Employee] |
| Dashboard            |                                           |
| Administration       | [Search employees...]                     |
|  - Employees         |                                           |
|  - Tax & Invoice     | +-----------------------------------------+ |
|  - Preferences       | | Comfortable Employee Table              | |
|  - Subscription     | |                                         | |
|  - Audit Logs        | | Employee | Role | Status | Actions      |
|                      | |----------|------|--------|---------      |
|                      | | Employee | Role | Active | View         |
|                      | | Employee | Role | Active | View         |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+----------------------+-------------------------------------------+
```

- Display employees or members belonging to the selected business workspace.
- Show employee name or account information, assigned role and employee status.
- Search and paginate employee records where supported.
- View employee details for authorized Business Owners.
- Exact employee deletion behavior is unspecified and is not included.

#### Invite Employee

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Invite Employee                                                  |
|                                                                  |
| Email * [_____________________________________________]          |
| Role *  [ Business Owner / Inventory Manager / Sales Employee / Accountant ] |
|                                                                  |
|                              [ Cancel ] [ Send Invitation ]     |
+------------------------------------------------------------------+
```

- Invite employees using email and role assignment.
- Supported business roles are Business Owner, Inventory Manager, Sales Employee and Accountant.
- Super Admin is platform-level access and is not assigned as a business workspace employee role in this screen.
- Exact invitation delivery, acceptance, expiry and password setup behavior is unspecified.
- No granular permission controls are shown; role and permission context remains at the role level.

#### Employee Details

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Employee Details                         |
| Dashboard            |                                           |
| Administration       | Employee information                     |
|  - Employees         | [Name] [Email]                            |
|  - Tax & Invoice     |                                           |
|  - Preferences       | Assigned role: [Role]                    |
|  - Subscription     | Role and permission context               |
|  - Audit Logs        | Status: [Active / Pending]               |
|                      |                                           |
+----------------------+-------------------------------------------+
```

- Display employee information, assigned role and status.
- Display role and permission context according to the original role definitions.
- Exact granular permissions are unspecified.
- Employee details remain scoped to the selected business workspace.

#### Pending Invitations

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Pending Invitations                                              |
|                                                                  |
| Email | Assigned role | Status: Pending                         |
| Email | Assigned role | Status: Pending                         |
|                                                                  |
| [ Close ]                                                        |
+------------------------------------------------------------------+
```

- Display pending employee invitations.
- Show invitation email, assigned role and pending status.
- Pending invitation is display-only in this task.
- Invitation delivery, acceptance, expiry and resend behavior is unspecified.

#### Employee Management Limitations

- Exact employee status names beyond Active and Pending are unspecified.
- Exact granular permissions and permission editing behavior are unspecified.
- Invitation delivery, acceptance, expiry and password setup workflows are unspecified.
- Employee deletion and removal workflows are unspecified.
- Super Admin access remains separate from business workspace employee management.

### 7.17 Subscription and Billing

#### Current Subscription

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Subscription Details                     |
| Administration       |                                           |
|  - Employees         | Current plan: [Starter / Growth / Enterprise] |
|  - Subscription     | Subscription status: [Status]              |
|  - Billing          | Renewal date: DD/MM/YYYY                  |
|  - Audit Logs        |                                           |
|                      | [View plan comparison]                    |
+------------------------------------------------------------------+
```

- Display the current plan name.
- Display subscription status.
- Display renewal date when subscription information is available.
- Keep business subscription context separate from Super Admin subscription management.
- Exact subscription status names and renewal behavior are unspecified.

#### Plan Comparison

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Subscription Plans                                               |
|                                                                  |
| Starter                                                          |
| [Final features not finalized]                                   |
|                                                                  |
| Growth                                                           |
| [Final features not finalized]                                   |
|                                                                  |
| Enterprise                                                       |
| [Final features not finalized]                                   |
|                                                                  |
| Pricing, usage limits and final feature availability are not finalized. |
+------------------------------------------------------------------+
```

- List Starter, Growth and Enterprise as the specified plan names.
- Do not invent per-plan features beyond the original specification.
- Pricing, usage limits and final feature availability remain not finalized.
- No upgrade, downgrade or plan checkout action is shown.

#### Billing Information

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Billing Information                                              |
|                                                                  |
| Subscription: [Current plan]                                     |
| Status: [Subscription status]                                    |
| Billing or invoice information: [Where available]                |
|                                                                  |
| [ Back ]                                                         |
+------------------------------------------------------------------+
```

- Display available invoice or billing information supported by subscription records.
- Exact billing fields and invoice formats are unspecified.
- No payment method, payment gateway or payment collection UI is included.
- No checkout, refund or payment-processing workflow is included.

#### Subscription Details

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Subscription Details                     |
| Administration       |                                           |
|  - Subscription     | Plan name: [Starter / Growth / Enterprise] |
|  - Billing          | Status: [Subscription status]             |
|  - Employees        | Renewal date: DD/MM/YYYY                  |
|  - Audit Logs       |                                           |
|                      | [View billing information]                 |
+------------------------------------------------------------------+
```

- Display current plan, subscription status and renewal date.
- Provide access to available billing information.
- Business subscription details remain isolated to the selected business workspace.
- Super Admin subscription management remains separate.

#### Subscription and Billing Limitations

- Exact prices, usage limits and final plan features are not finalized.
- Exact subscription status names and renewal behavior are unspecified.
- Exact billing fields and invoice formats are unspecified.
- No payment method, checkout, upgrade, downgrade, cancellation, refund or auto-renewal workflow is specified.

### 7.18 Notifications

#### Notification List

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Notifications                         |
| Dashboard            |                                           |
| Administration       | [All] [Stock Alerts] [System]             |
|  - Notifications     |                                           |
| Intelligence         | [Unread] [Stock Alert] [Title]             |
|                      | [Message or available context]             |
|                      | DD/MM/YYYY, [HH:MM]                        |
|                      |                                           |
|                      | [Read] [System] [Title]                    |
|                      | [Message or available context]             |
|                      | DD/MM/YYYY, [HH:MM]                        |
|                      |                                           |
|                      | [Mark as read]                             |
+------------------------------------------------------------------+
```

- Display notifications in chronological order when notification data is available.
- Show notification title and available message or context.
- Show date/time where supported by the notification record.
- Distinguish unread notifications visually from read notifications.
- Notification records remain scoped to the selected business workspace.

#### Notification Categories

```text
+------------------------------------------------------------------+
| Notification Category | Display context                            |
|-----------------------|--------------------------------------------|
| Stock Alert           | Low stock, out of stock or reorder context |
| System                | System notification context                |
+------------------------------------------------------------------+
```

- Stock alert notifications include low-stock, out-of-stock and reorder information where supported.
- System notifications contain system notification context defined by the platform.
- No additional notification category is introduced.
- Notification category names remain limited to those supported by the specification.

#### Notification Interaction

```text
+------------------------------------------------------------------+
| [Unread notification]                                              |
| Title                                                              |
| Message or available context                                       |
| [Mark as read]                                                    |
+------------------------------------------------------------------+
```

- A mark-as-read interaction updates the unread notification to read.
- Read notifications use a distinct visual state.
- Exact mark-as-read behavior, timestamps and confirmation feedback are unspecified.
- No delete, archive or delivery-control action is shown unless separately specified.

#### Notification States

```text
+------------------------------------------------------------------+
| Loading: [Loading notifications...]                               |
|                                                                  |
| Empty: [No notifications]                                         |
|                                                                  |
| Unread: [Unread visual state and mark-as-read action]             |
| Read: [Read visual state]                                         |
+------------------------------------------------------------------+
```

- Show loading while notifications are retrieved.
- Show an empty state when no notifications exist.
- Keep read and unread states visually distinct.
- Alert-generation timing and notification delivery guarantees are unspecified.

#### Notifications Limitations

- Notification types are limited to Stock Alert and System notification categories.
- SMS, push notification, WhatsApp and other delivery channels are not included.
- Notification scheduling, retry behavior and delivery guarantees are unspecified.
- Optional email notification preferences remain in the Stock Alerts/Notification Preferences scope.

### 7.19 Audit Logs

#### Audit Log Activity Table

```text
+------------------------------------------------------------------+
| [Menu] StockPilot          [Workspace] [Alerts] [User]            |
+----------------------+-------------------------------------------+
| Fixed Left Sidebar   | Audit Logs                               |
| Dashboard            |                                           |
| Administration       | [Date: DD/MM/YYYY - DD/MM/YYYY] [User ▼] |
|  - Audit Logs        |                                           |
|  - Employees         | +-----------------------------------------+ |
|  - Subscription     | | Comfortable Audit Log Table              | |
|  - Preferences       | |                                         | |
|                      | | Time | User | Action | Module | Record |
|                      | |------|------|--------|--------|--------|
|                      | | DD/MM/YYYY, HH:MM | User | Action | Module | Record |
|                      | | DD/MM/YYYY, HH:MM | User | Action | Module | Record |
|                      | +-----------------------------------------+ |
|                      | [<] [1] [2] [3] [>]                       |
+------------------------------------------------------------------+
```

- Display chronological business audit activity.
- Show user, action, module, record and time.
- Record ID is available as the record reference where supported.
- Audit history remains read-only.
- Business audit logs remain isolated to the selected business workspace.
- Platform-level Super Admin activities are not included in business audit logs.

#### Audit Log Filters

```text
+------------------------------------------------------------------+
| Audit Log Filters                                                |
|                                                                  |
| Date [ DD/MM/YYYY - DD/MM/YYYY ]                                 |
| User [ Select business user ▼ ]                                   |
|                                                                  |
| [ Reset ] [ Apply Filters ]                                      |
+------------------------------------------------------------------+
```

- Filter audit records by date and user.
- Display filtered results in the chronological activity table.
- Exact additional audit filters are unspecified.
- Filter state remains scoped to the selected business workspace.

#### Audit Log Details

```text
+------------------------------------------------------------------+
| StockPilot  [Workspace: Store]                  [Close]           |
+------------------------------------------------------------------+
| Audit Log Details                                                |
|                                                                  |
| User: [User]                                                     |
| Action: [Action]                                                 |
| Module: [Module]                                                 |
| Record: [Record ID or available reference]                        |
| Description: [Available activity description]                    |
| Time: DD/MM/YYYY, [HH:MM]                                        |
|                                                                  |
| Read-only audit record                                           |
+------------------------------------------------------------------+
```

- Display available activity information for the selected audit record.
- Show user, action, module, record reference, description and time where stored.
- Audit detail is read-only.
- No edit, delete, restore or manual log creation action is included.

#### Audit Log States

```text
+------------------------------------------------------------------+
| Loading: [Loading audit activity...]                             |
| Empty: [No audit records available]                               |
| Filtered: [Filtered audit records displayed]                      |
+------------------------------------------------------------------+
```

- Loading state is shown while audit activity is retrieved.
- Empty or no-records state is shown when no audit activity exists.
- Filtered-results state shows records matching date and user filters.
- No audit export or retention-management state is included.

#### Audit Log Limitations

- Exact audit event types and filtering behavior beyond date and user are unspecified.
- Exact record-link behavior and description formatting are unspecified.
- Audit records remain read-only and are not editable or removable.
- No audit export or retention policy is specified in this task.
- Business audit logs and Super Admin platform activity remain separate.

### 7.20 Super Admin Panel

#### Platform Dashboard

```text
+------------------------------------------------------------------+
| StockPilot Platform | Super Admin | [User menu]                   |
+----------------------+-------------------------------------------+
| Platform Navigation  | Platform Overview                        |
| Business Accounts    |                                           |
| Subscriptions        | [Platform-level metrics, where supported] |
| Platform Usage       |                                           |
| Support Requests     | [Platform overview context]               |
| System Configuration |                                           |
| Platform Analytics   |                                           |
+------------------------------------------------------------------+
```

- Provide a platform-level overview for Super Admin.
- Exact platform dashboard metrics are unspecified.
- Platform dashboard data must not reuse business-level inventory or sales analytics unless explicitly supported.
- Super Admin navigation remains separate from business workspace navigation.

#### Business Account Management

```text
+------------------------------------------------------------------+
| Platform | Business Accounts                                      |
+------------------------------------------------------------------+
| [Search business accounts...]                                     |
|                                                                  |
| Business account | Subscription | Status | [View]                |
| ---------------------------------------------------------------- |
| [Business account] | [Plan] | [Status] | [View]                  |
|                                                                  |
+------------------------------------------------------------------+
```

```text
+------------------------------------------------------------------+
| Business Account Details                                          |
|                                                                  |
| Business account information                                     |
| Subscription status                                               |
| Account status: [Active / Deactivated]                            |
|                                                                  |
| [Activate Account] [Deactivate Account]                           |
+------------------------------------------------------------------+
```

- Display business account list and business account details.
- Account activation/deactivation context is supported by Super Admin account management.
- Exact account fields and status labels are unspecified.
- No business workspace data is shown outside authorized platform administration context.

#### Subscription Management

```text
+------------------------------------------------------------------+
| Platform | Subscriptions                                          |
+------------------------------------------------------------------+
| [Search subscriptions...]                                         |
|                                                                  |
| Business | Plan | Subscription status | Action                    |
| ----------|------|--------------------|--------                   |
| [Business] | [Plan] | [Status] | [Activate / Deactivate]          |
+------------------------------------------------------------------+
```

- Provide platform-level subscription overview.
- Display plan name and subscription status where available.
- Activation/deactivation context is supported for Super Admin.
- Exact subscription statuses, workflows and transition rules are unspecified.
- This screen is separate from business workspace subscription and billing information.
- No payment, checkout, refund or billing collection workflow is shown.

#### Platform Usage Monitoring

```text
+------------------------------------------------------------------+
| Platform | Usage Monitoring                                       |
+------------------------------------------------------------------+
| [Supported platform usage overview]                               |
|                                                                  |
| [Usage metric]                                                    |
| [Usage metric context]                                            |
+------------------------------------------------------------------+
```

- Show only platform usage metrics explicitly supported by the original specification.
- Exact usage metrics and aggregation periods are unspecified.
- No final usage limits or detailed account limits are shown.

#### Support Requests

```text
+------------------------------------------------------------------+
| Platform | Support Requests                                      |
+------------------------------------------------------------------+
| [Search support requests...]                                      |
|                                                                  |
| Support request | [Available context] | [View]                    |
| Support request | [Available context] | [View]                    |
+------------------------------------------------------------------+
```

```text
+------------------------------------------------------------------+
| Support Request Details                                           |
|                                                                  |
| [Supported request information]                                   |
| [Available context]                                               |
|                                                                  |
| [Close]                                                           |
+------------------------------------------------------------------+
```

- Display the support request queue and request details.
- Exact support request fields and status names are unspecified.
- No unsupported support workflow or status transition is shown.

#### System Configuration

```text
+------------------------------------------------------------------+
| Platform | System Configuration                                   |
+------------------------------------------------------------------+
| [System configuration overview]                                   |
|                                                                  |
| Exact configuration fields and controls are unspecified.         |
+------------------------------------------------------------------+
```

- Provide a system configuration overview only.
- Do not display or assume configuration fields, values or controls.
- Exact platform configuration capabilities remain unspecified.

#### Platform Analytics

```text
+------------------------------------------------------------------+
| Platform | Platform Analytics                                     |
+------------------------------------------------------------------+
| [Platform-level analytics overview]                               |
|                                                                  |
| [Only explicitly supported platform metrics]                     |
|                                                                  |
+------------------------------------------------------------------+
```

- Display platform-level analytics overview.
- Do not reuse business-level sales, inventory or profit analytics unless explicitly supported.
- Exact platform metrics and chart types are unspecified.

#### Super Admin Limitations

- Exact platform dashboard metrics and platform usage metrics are unspecified.
- Exact business account fields and status labels are unspecified.
- Subscription status names and activation/deactivation rules are unspecified.
- Exact support request fields and support statuses are unspecified.
- System configuration fields and controls are unspecified.
- Platform-level analytics metrics and chart types are unspecified.
- No payment, checkout, refund or billing collection workflow is included.

## 8. Design Scope
The UI must support the modules and workflows specified in the StockPilot product requirements.

No additional product modules or workflows are included in this specification.
