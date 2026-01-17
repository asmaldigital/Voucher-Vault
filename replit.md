# SuperSave Voucher Management System

## Overview
A voucher management system for SuperSave, a South African supermarket. The system tracks R50 paper vouchers with unique barcodes, allowing staff to scan and instantly mark vouchers as redeemed. Built with React, Tailwind CSS, Express backend, and Replit's built-in PostgreSQL database.

## Tech Stack
- **Frontend**: React 18 with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with session-based authentication
- **Database**: Replit's built-in PostgreSQL with Drizzle ORM
- **Authentication**: Session-based auth with bcryptjs password hashing
- **State Management**: TanStack Query for data fetching
- **Routing**: Wouter

## Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/           # shadcn/ui components
│   │   │   ├── app-header.tsx
│   │   │   ├── app-sidebar.tsx
│   │   │   └── protected-route.tsx
│   │   ├── lib/
│   │   │   ├── auth-context.tsx # Auth state management
│   │   │   └── queryClient.ts
│   │   ├── pages/
│   │   │   ├── login.tsx     # Login page
│   │   │   ├── dashboard.tsx # Stats overview
│   │   │   ├── scan.tsx      # Scan/redeem vouchers
│   │   │   ├── vouchers.tsx  # Voucher list with filters
│   │   │   ├── import.tsx    # CSV import
│   │   │   ├── reports.tsx   # Redemption reports
│   │   │   ├── users.tsx     # User management (admin only)
│   │   │   └── export.tsx    # CSV data export (admin only)
│   │   └── App.tsx
├── server/
│   ├── routes.ts             # API endpoints
│   ├── storage.ts            # Database storage layer
│   ├── db.ts                 # Drizzle database connection
│   └── index.ts
├── shared/
│   └── schema.ts             # Drizzle schema, TypeScript types, and Zod schemas
└── drizzle.config.ts         # Drizzle configuration
```

## Database Schema (Drizzle ORM)

### users table
- `id` (UUID, primary key)
- `email` (unique string)
- `password` (hashed string)
- `role` (enum: 'super_admin', 'admin', 'editor')
- `createdAt` (timestamp)
- `createdBy` (user id, nullable)

### vouchers table
- `id` (UUID, primary key)
- `barcode` (unique string)
- `value` (integer, default 50)
- `status` (enum: 'available', 'redeemed', 'expired', 'voided')
- `batchNumber` (string)
- `bookNumber` (string, nullable) - Book tracking (1600 vouchers per book = R80,000)
- `accountId` (UUID, nullable) - Reference to bulk buyer account
- `createdAt` (timestamp)
- `redeemedAt` (timestamp, nullable)
- `redeemedBy` (user id, nullable)
- `redeemedByEmail` (string, nullable)

### accounts table (Bulk Buyers)
- `id` (UUID, primary key)
- `name` (string) - Account/company name
- `contactName` (string, nullable) - Primary contact person
- `email` (string, nullable)
- `phone` (string, nullable)
- `notes` (text, nullable)
- `createdAt` (timestamp)

### password_reset_tokens table
- `id` (UUID, primary key)
- `userId` (UUID, reference to users)
- `token` (string, unique)
- `expiresAt` (timestamp)
- `usedAt` (timestamp, nullable)

### auditLogs table
- `id` (UUID, primary key)
- `action` (string: 'created', 'redeemed', 'voided', 'expired', 'imported')
- `voucherId` (reference to vouchers)
- `userId` (who performed the action)
- `userEmail` (email of who performed the action)
- `timestamp` (timestamp)
- `details` (JSONB for extra info)

## Setup Instructions

### 1. Database Setup
The database is automatically configured through Replit's built-in PostgreSQL. Run:
```bash
npm run db:push
```

### 2. Environment Variables
- `DATABASE_URL`: Automatically set by Replit
- `SESSION_SECRET`: Used for session encryption (defaults to generated value)

### 3. Initial Admin User
After starting the app for the first time, create an admin user via the setup endpoint:
```bash
curl -X POST http://localhost:5000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@supersave.co.za", "password": "admin123", "role": "admin"}'
```

### 4. Running the App
```bash
npm run dev
```

## Default Admin Credentials
- Email: admin@supersave.co.za
- Password: SuperSaveAdmin2026!

## Key Features

### 1. Login (Protected Access)
- Email/password authentication
- Session-based auth with secure cookies
- All pages require login
- User email displayed in header
- Logout functionality

### 2. Dashboard
- Total vouchers count
- Available vouchers count
- Redeemed today count
- Total/redeemed value in Rands
- Quick action links

### 3. Scan & Redeem
- Large barcode input field
- Instant redemption on submit
- Success state with value confirmation
- Error states for already-redeemed, not-found, expired, voided
- Shows who/when for already-redeemed vouchers

### 4. Vouchers List
- Paginated table view
- Filter by status
- Search by barcode, batch, or book number
- Book number column for tracking voucher books (1600 vouchers = R80,000)
- Status badges with colors

### 5. Import
- CSV file upload (drag & drop)
- Batch number assignment
- Book number assignment (optional, for tracking voucher books)
- Configurable voucher value
- Progress indicator
- Import results summary

### 6. Reports
- Date range selection
- Redemption count, value, staff stats
- Exportable to CSV
- Detailed redemption history table

### 7. User Management (Admin Only)
- View all staff members with roles
- Create new users with email/password
- Assign Admin or Editor roles
- Role-based sidebar (Users menu only visible to admins)

### 8. Analytics Dashboard
- Visual charts for redemption trends (Recharts library)
- Time range selection: 7 days, 30 days, 90 days, 12 months
- Automatic grouping by day, week, or month based on range
- Key metrics: total redemptions, value redeemed, daily average, trend %
- Tab switching between count and value views

### 9. Accounts (Bulk Buyers)
- Manage ~20 bulk buyer accounts
- Track voucher allocations per account
- View total, available, and redeemed vouchers per account
- Contact information management (name, email, phone)
- Summary statistics across all accounts
- **Purchase Tracking**: Record purchases in Rands (must be multiples of R50)
- **Balance Display**: Shows purchased amount, redeemed value, and remaining balance
- **Purchase History**: View all purchases per account with date, amount, and notes

### 11. Data Export (Admin Only)
- Manual CSV export for all data types
- Export options: Vouchers, Accounts, Purchases, Users, Audit Logs
- South African Rand formatting (R prefix, comma separators)
- Date-stamped filenames for versioning
- Excel-compatible format for easy analysis
- Backup alternative to cloud sync (user can save to OneDrive manually)

### 10. Password Reset
- Forgot password link on login page
- Secure token-based reset flow
- Tokens expire after 1 hour
- Single-use tokens (marked as used after reset)
- Strong password validation during reset
- Development mode shows reset link (production would send email)

## Design System
- Primary color: Lime Green (SuperSave branding - HSL: 80 61% 50%)
- Secondary color: Red (HSL: 0 100% 50%)
- Font: Roboto (sans) and Roboto Mono (for barcodes/values)
- Mobile-first responsive design
- Large touch targets for scanning

## Security
- Session-based authentication with secure httpOnly cookies
- Password hashing with bcryptjs (10 salt rounds)
- Only authenticated users can access data
- All actions logged to audit_logs
- Role-based access control: Admin and Editor roles
- User management endpoints enforce admin-only access
- Admin users can void vouchers; editors cannot
- Strong password requirements: 8+ chars, uppercase, lowercase, number, special character
- Secure password reset with time-limited tokens

## User Roles
- **Super Admin**: Full access plus Google Drive backup and restore features
- **Admin**: Full access including user management, voiding vouchers
- **Editor**: Standard access for scanning, redeeming, importing, and viewing reports

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `DELETE /api/users/:id` - Delete a user (cannot delete self)

### Vouchers
- `GET /api/vouchers` - List vouchers with filters (supports status, search, accountId)
- `GET /api/vouchers/books` - Get unique book numbers for filtering
- `GET /api/vouchers/:barcode` - Get voucher by barcode
- `POST /api/vouchers/redeem` - Redeem a voucher
- `POST /api/vouchers/import` - Bulk import vouchers
- `POST /api/vouchers/:id/void` - Void a voucher (Admin only)

### Dashboard & Reports
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/reports` - Audit logs with date range filter
- `GET /api/reports/books` - Book statistics (totals per book, outstanding values)
- `GET /api/reports/books/:bookNumber/redemptions` - Book redemptions by period
- `GET /api/analytics/redemptions` - Redemption data grouped by period

### Accounts
- `GET /api/accounts` - List all accounts with voucher stats
- `POST /api/accounts` - Create new bulk buyer account
- `GET /api/accounts/:id/purchases` - Get account purchase history
- `POST /api/accounts/:id/purchases` - Record a purchase for account
- `GET /api/accounts/:id/redemptions` - Get account manual redemptions
- `POST /api/accounts/:id/redemptions` - Record manual fund redemption

### Setup
- `POST /api/setup` - Create initial admin user (only works when no users exist)

## Recent Changes (January 2026)
- Migrated from Supabase to Replit's built-in PostgreSQL database
- Implemented Drizzle ORM for type-safe database operations
- Switched to session-based authentication with express-session
- Added bcryptjs for secure password hashing
- Created DatabaseStorage class with full CRUD operations
- Updated all frontend pages to use new API endpoints
- Added setup endpoint for creating initial admin user
- Removed all Supabase dependencies and configuration
- Added book number tracking to vouchers (1600 per book = R80,000)
- Created Accounts page for managing bulk buyers
- Built Analytics dashboard with redemption charts and forecasting
- Implemented forgot password / reset password functionality
- Added strong password validation with real-time feedback
- Enhanced Reports page with Book Summary tab showing totals per book and outstanding values
- Added manual fund redemption feature for accounts with user/date/time tracking
- Added account filter to Vouchers page
- Added delete user functionality for admins
- Changed "Total Purchased" to "Total Received" in Accounts section
- Fixed Analytics page data loading issue
- Added book filter to Export page with 5-second auto-refresh
- Enhanced error messages to show book number when voucher already redeemed
