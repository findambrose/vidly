# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **Paddle Billing subscriptions Next.js starter kit** - a complete SaaS application template built with modern web technologies. The app provides a subscription billing solution with integrated checkout, user management, and payment processing powered by Paddle Billing.

## Development Commands

**Primary Development:**
- `pnpm dev` - Start Next.js development server on port 3000
- `pnpm build` - Build production bundle with Next.js
- `pnpm start` - Run production build locally

**Code Quality:**
- `pnpm lint` - Run ESLint with Next.js configuration
- `pnpm lint:fix` - Auto-fix ESLint issues
- `pnpm prettier` - Format all code with Prettier
- `pnpm prettier:check` - Check code formatting without making changes
- `pnpm test` - Run full linting and formatting checks (no unit tests configured)

**Supabase Local Development:**
- Navigate to project directory and run standard Supabase CLI commands
- Local Supabase runs on ports: API (54321), Studio (54323), DB (54322)
- Migrations in `supabase/migrations/` handle customer and subscription tables

## Architecture Overview

**Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind CSS
**UI Components:** shadcn/ui with Radix UI primitives
**Authentication:** Supabase Auth with Google OAuth support
**Database:** PostgreSQL via Supabase with real-time subscriptions
**Billing:** Paddle Billing with webhook integration
**Deployment:** Vercel-optimized with App Router

### Core Structure

**App Router Pages:**
- `/` - Landing page with pricing tiers
- `/login`, `/signup` - Authentication pages with Supabase
- `/dashboard` - Protected customer portal
- `/dashboard/subscriptions` - Subscription management
- `/dashboard/payments` - Payment history
- `/checkout/[priceId]` - Paddle checkout integration
- `/api/webhook` - Paddle webhook endpoint for subscription syncing

**Key Directories:**
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - Organized by feature (authentication, dashboard, home, shared, ui)
- `src/utils/paddle/` - Paddle Billing SDK integrations
- `src/utils/supabase/` - Supabase client configurations
- `src/constants/` - Pricing tier configurations and app constants
- `supabase/migrations/` - Database schema and policies

### Data Flow Architecture

1. **Pricing Display:** Frontend fetches localized prices from Paddle via client-side token
2. **Checkout:** Paddle.js handles secure payment processing with optimized payment methods
3. **Webhook Processing:** Paddle sends events to `/api/webhook` for subscription sync
4. **Database Sync:** Customer and subscription data automatically synced between Paddle and Supabase
5. **Customer Portal:** Protected dashboard displays subscription status and payment history

## Configuration Requirements

### Environment Variables
- `PADDLE_API_KEY` - Server-side Paddle API key for webhook processing
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` - Client-side token for frontend Paddle integration
- `PADDLE_NOTIFICATION_WEBHOOK_SECRET` - Webhook signature verification secret
- `NEXT_PUBLIC_PADDLE_ENV` - Either "sandbox" or "production"
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### Key Configuration Files
- `src/constants/pricing-tier.ts` - Define subscription plans and map to Paddle price IDs
- `supabase/config.toml` - Local Supabase configuration
- `components.json` - shadcn/ui configuration with custom CSS variables

## Development Guidelines

### Paddle Integration Patterns
- Always use `getPaddleInstance()` for server-side Paddle operations
- Client-side pricing uses Paddle.js with environment-specific tokens
- Webhook processing handles customer and subscription lifecycle events
- Price IDs in `pricing-tier.ts` must match Paddle catalog configuration

### Supabase Integration Patterns
- Row Level Security (RLS) policies protect customer data access
- Authenticated users can only read their own customer and subscription records
- Database schema designed for webhook-driven data synchronization
- Use Supabase client utilities in `src/utils/supabase/`

### UI/UX Patterns
- Responsive three-tier pricing page with feature comparison
- Protected dashboard routes require authentication
- Loading states and error handling for async operations
- shadcn/ui components with consistent design system

## Testing Strategy

- ESLint + Prettier for code quality (no unit test framework configured)
- Manual testing workflow: pricing page → checkout → webhook verification → dashboard
- Use Paddle sandbox environment for development testing
- Test card: `4242 4242 4242 4242` with future expiry and CVV `100`

## Important Notes

- This is a **starter kit template** - customize pricing tiers, product catalogs, and branding
- Webhook endpoint must be registered in Paddle dashboard for proper subscription syncing
- Website URLs must be approved in Paddle before checkout can function
- Supabase database policies ensure secure multi-tenant data access
- Production deployment requires transitioning from sandbox to live Paddle account