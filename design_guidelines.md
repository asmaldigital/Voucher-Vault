# SuperSave Voucher Management System - Design Guidelines

## Design Approach
**Selected System:** Material Design 3
**Rationale:** Utility-focused, data-intensive staff application requiring clear visual feedback, mobile-first design, and enterprise-grade reliability for rapid voucher operations.

## Color System

**Primary Palette:**
- **Lime Green (#9ACD32):** Primary actions, success states, active navigation, voucher available status
- **Vibrant Red (#FF0000):** Error states, voided vouchers, destructive actions, critical alerts
- **White (#FFFFFF):** Card backgrounds, input fields, primary text on colored backgrounds

**Supporting Colors:**
- **Neutral Gray Scale:** 
  - Gray-50: Page backgrounds
  - Gray-200: Borders, dividers
  - Gray-600: Secondary text
  - Gray-800: Primary text
  - Gray-900: Headings
- **Semantic Colors:**
  - Success: Lime green (#9ACD32)
  - Error: Vibrant red (#FF0000)
  - Warning: Amber-500 (#F59E0B) for expiring vouchers
  - Info: Blue-500 (#3B82F6) for neutral alerts
  - Redeemed Status: Gray-400 (muted/completed)

**Contrast Requirements:**
- Text on lime green: White text only (WCAG AAA compliant)
- Text on red: White text only
- Minimum 4.5:1 contrast ratio for all body text
- 7:1 for critical data (barcodes, monetary values)

## Typography System

**Font Family:** Roboto via Google Fonts
- Headings: Roboto Medium (500)
- Body: Roboto Regular (400)
- Data/Monospace: Roboto Mono (barcodes, amounts, timestamps)

**Type Scale:**
- Page Titles: text-3xl font-medium
- Section Headers: text-xl font-medium
- Card Titles: text-lg font-medium
- Body Text: text-base
- Labels/Meta: text-sm
- Large Scan Feedback: text-6xl font-medium (barcode confirmation)

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section gaps: gap-6 to gap-8
- Page margins: p-6 mobile, p-8 desktop
- Card interiors: p-6

**Container Structure:**
- Dashboard max-width: max-w-7xl
- Form containers: max-w-2xl
- Login card: max-w-md
- Mobile: Full-width with rounded-lg corners

## Component Library

### Top Navigation Bar
- Fixed position, white background with subtle shadow
- SuperSave logo (lime green/red branding) left-aligned
- User email display center/right
- Logout button (red outline on hover)
- Mobile: Hamburger menu icon, collapsible navigation
- Desktop: Horizontal nav links with lime green underline on active state

### Dashboard Stat Cards
- White elevated cards (shadow-md) in 3-column grid (lg), stacked mobile
- Large numerical displays (text-5xl) in gray-900
- Icon circles with lime green backgrounds, white icons
- Labels in text-sm gray-600
- Metrics: Total Vouchers, Redeemed Today, Available Now, Revenue Today

### Scan/Redeem Interface (Primary Workflow)
- Full-screen focus, minimal distractions
- Large input field (h-16, text-2xl) with thick lime green border focus state
- Auto-focus on mount, number pad keyboard
- Success state: Full-screen lime green background, large checkmark icon (white), barcode display in Roboto Mono (text-4xl), customer name, "Scan Another" button (white with lime green text)
- Error state: Full-screen red background, alert icon (white), clear error message ("Already redeemed by [Name] at [Time]"), "Try Again" button
- Processing: White background, centered lime green spinner

### Voucher List Table
- Sticky header with gray-50 background
- Alternating row backgrounds (white/gray-50)
- Status badges:
  - Available: Lime green background, white text, rounded-full
  - Redeemed: Gray-400 background, white text
  - Expired: Red background, white text
  - Voided: Red outline, red text
- Row actions: Three-dot menu (gray-600)
- Mobile: Card layout stacking key fields vertically
- Filter dropdowns above table (white background, gray-200 borders)
- Pagination: Lime green active page number

### Bulk Import Form
- Drag-and-drop CSV zone: Dashed lime green border, gray-50 background
- Upload button: Lime green filled, white text
- Progress bar during import: Lime green fill
- Validation feedback: Red text for errors, lime green checkmarks for success
- Sample CSV download link in blue-500

### Reports Page
- Date range picker inputs side-by-side
- Export CSV button: Lime green filled
- Summary cards above table (same style as dashboard cards)
- Bar chart placeholder: Lime green bars showing daily redemption trends

### Login Page
- Centered white card on gray-50 background
- SuperSave logo prominent at top
- Email/password inputs with floating labels
- Show/hide password toggle icon
- Large login button: Lime green background, white text, full-width
- Error messages below fields in red text

### Buttons
- Primary: Lime green background, white text, h-12, rounded-lg, shadow-sm
- Secondary: White background, lime green border and text
- Destructive: Red background, white text
- Text: Lime green text, no background
- Icon-only: w-12 h-12, circular, gray-600 icon

### Alerts & Toasts
- Success: Lime green left border (4px), white background, checkmark icon
- Error: Red left border, white background, alert icon
- Info: Blue-500 left border
- Toast position: Top-right, auto-dismiss 4 seconds
- Include close button (gray-600)

## Mobile Optimization
- Bottom-anchored "Scan Voucher" floating action button (lime green, white icon)
- Single-column layouts throughout
- Large touch targets (min 44x44px)
- Pull-to-refresh on voucher list (lime green spinner)
- Landscape support for barcode scanning
- Haptic feedback on successful scans

## Accessibility
- High contrast text on all colored backgrounds
- Focus rings: 2px lime green outline on interactive elements
- Screen reader labels for icon buttons
- Semantic HTML structure
- ARIA labels for status badges
- Keyboard navigation support (Tab, Enter, Escape)

## Key Interactions
- Instant visual feedback (<100ms response)
- Optimistic UI updates with rollback
- Loading states: Lime green spinner animations
- Error recovery: Clear "Try Again" CTAs
- Keyboard shortcuts: Enter to submit, Escape to cancel
- Auto-clear scan input after 3 seconds of inactivity