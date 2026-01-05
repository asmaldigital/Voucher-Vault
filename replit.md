# SuperSave Voucher Management System

## Overview
A voucher management system for SuperSave, a South African supermarket. The system tracks R50 paper vouchers with unique barcodes, allowing staff to scan and instantly mark vouchers as redeemed. Built with React, Tailwind CSS, and Supabase for backend and authentication.

## Tech Stack
- **Frontend**: React 18 with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL database with Row Level Security)
- **Authentication**: Supabase Auth (email/password)
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
│   │   │   ├── supabase.ts   # Supabase client initialization
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
│   ├── routes.ts             # API endpoint for config
│   └── index.ts
├── shared/
│   └── schema.ts             # TypeScript types and Zod schemas
└── supabase-setup.sql        # SQL to create tables in Supabase
```

## Database Schema

### vouchers table
- `id` (UUID, primary key)
- `barcode` (unique string)
- `value` (integer, default 50)
- `status` (enum: 'available', 'redeemed', 'expired', 'voided')
- `batch_number` (string)
- `created_at` (timestamp)
- `redeemed_at` (timestamp, nullable)
- `redeemed_by` (user id, nullable)
- `redeemed_by_email` (string, nullable)

### audit_log table
- `id` (UUID, primary key)
- `action` (string: 'created', 'redeemed', 'voided', 'expired', 'imported')
- `voucher_id` (reference to vouchers)
- `user_id` (who performed the action)
- `timestamp` (timestamp)
- `details` (JSONB for extra info)

### user_profiles table
- `id` (UUID, primary key, references auth.users)
- `email` (string)
- `role` (enum: 'admin', 'editor')
- `created_at` (timestamp)
- `created_by` (user id, nullable)

## Setup Instructions

### 1. Supabase Configuration
1. Create a new Supabase project
2. Go to SQL Editor and run the contents of `supabase-setup.sql`
3. Enable Email Auth in Authentication > Providers
4. Create test users in Authentication > Users

### 2. Environment Variables
The following secrets are required:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for admin user creation)

### 3. Running the App
```bash
npm run dev
```

## Key Features

### 1. Login (Protected Access)
- Email/password authentication
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
- Primary color: Green (SuperSave branding)
- Font: Roboto (sans) and Roboto Mono (for barcodes/values)
- Mobile-first responsive design
- Large touch targets for scanning

## Security
- Row Level Security on all Supabase tables
- Only authenticated users can access data
- All actions logged to audit_log
- No API keys exposed in frontend code
- RLS policy restricts voucher updates: only `available` status can transition to `redeemed`
- Prevents double-redemption and status tampering at database level
- Role-based access control: Admin and Editor roles
- User management endpoints enforce admin-only access at both API and RLS levels
- Admin users can void vouchers; editors cannot

## User Roles
- **Admin**: Full access including user management, voiding vouchers
- **Editor**: Standard access for scanning, redeeming, importing, and viewing reports

## Architecture Notes

### Supabase Initialization Pattern
The Supabase client is initialized asynchronously because credentials are fetched from `/api/config`. To prevent race conditions:

1. `initSupabase()` returns a Promise that resolves to the Supabase client
2. `AuthProvider` calls `initSupabase()` on mount and stores the client in state
3. `useSupabase()` hook returns `{ supabase, isReady }` for async-safe access
4. All React Query hooks use `enabled: isReady` to wait for initialization

This pattern ensures no database queries are made before the Supabase client is ready.

### Recent Changes (January 2026)
- Fixed critical race condition in Supabase client initialization
- Strengthened RLS policies to only allow `available` → `redeemed` transitions
- Added `useSupabase()` hook with `isReady` flag for async-safe data access
- All page components now properly wait for Supabase before querying
- Added multi-level user roles system (Admin/Editor)
- Created user_profiles table with RLS policies for admin-only management
- Added backend API endpoints for creating and listing users
- Auth context now exposes userRole and isAdmin flags
- Created admin-only Users management page
- Sidebar dynamically shows/hides admin-only menu items based on role
