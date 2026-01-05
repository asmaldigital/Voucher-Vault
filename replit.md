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
│   │   │   └── users.tsx     # User management (admin only)
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
- `role` (enum: 'admin', 'editor')
- `createdAt` (timestamp)
- `createdBy` (user id, nullable)

### vouchers table
- `id` (UUID, primary key)
- `barcode` (unique string)
- `value` (integer, default 50)
- `status` (enum: 'available', 'redeemed', 'expired', 'voided')
- `batchNumber` (string)
- `createdAt` (timestamp)
- `redeemedAt` (timestamp, nullable)
- `redeemedBy` (user id, nullable)
- `redeemedByEmail` (string, nullable)

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
- Password: admin123

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
- Search by barcode or batch
- Status badges with colors

### 5. Import
- CSV file upload (drag & drop)
- Batch number assignment
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

## User Roles
- **Admin**: Full access including user management, voiding vouchers
- **Editor**: Standard access for scanning, redeeming, importing, and viewing reports

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/me` - Get current user info

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user

### Vouchers
- `GET /api/vouchers` - List vouchers with filters
- `GET /api/vouchers/:barcode` - Get voucher by barcode
- `POST /api/vouchers/redeem` - Redeem a voucher
- `POST /api/vouchers/import` - Bulk import vouchers
- `POST /api/vouchers/:id/void` - Void a voucher (Admin only)

### Dashboard & Reports
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/reports` - Audit logs with date range filter

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
