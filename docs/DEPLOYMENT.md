# MarginMaster DeFi Copy Trading Platform - Deployment Guide

**Version:** 1.2.0
**Date:** 2026-02-05
**Status:** Production Ready (Testnet)

---

## 📦 Project Overview

MarginMaster is a hybrid DeFi copy trading platform combining:
- **Backend:** TypeScript/Express/Prisma/Supabase PostgreSQL (off-chain state & indexer)
- **Blockchain:** Sui Move smart contracts (on-chain financial operations, deployed on Testnet)
- **Frontend:** React + Vite + Tailwind (user interface)

---

## ✅ What Has Been Built

### 🗄️ Backend Package (packages/backend/)

**Database & API Status:**
- ✅ **Database:** Deployed to Supabase (7 Models, 100% Tests Passed)
- ✅ **API Server:** Express.js running on port 3001
- ✅ **Real-time:** Socket.IO for price updates and notifications
- ✅ **Indexer:** Custom Event Indexer syncing Sui events to Postgres

**API Endpoints Implemented:**
- `GET /api/leaderboard`: Trader rankings
- `GET /api/traders/:address/stats`: User performance
- `POST /api/copy-trades/register`: On-chain + Off-chain sync
- `POST /api/copy-trades/deactivate/:id`: Stop copying
- `GET /api/positions/:address`: Active positions

**Tech Stack:**
```json
{
  "runtime": "Node.js 24.x",
  "framework": "Express.js",
  "orm": "Prisma 5.22.0",
  "database": "PostgreSQL (Supabase)",
  "testing": "Verify Script (E2E)",
  "language": "TypeScript 5.x"
}
```

---

### ⛓️ Smart Contracts Package (packages/contracts/)

**Sui Move Modules (Deployed on Testnet):**

| Module | Status | Network | Package ID |
|--------|--------|---------|------------|
| margin_master | ✅ DEPLOYED | Testnet | `0x361681e0d8b2fdca428a4c4afb9e27af251a0fc3b543e4cb8738d2510a449ca4` |
| CopyRelationRegistry | ✅ CREATED | Testnet | `0x452e7b7822f255e40f5df3d075d18b292a72cd315502a744598d45fb6f580672` |

**Features Verified:**
- ✅ Margin trading (Leverage 1x-20x)
- ✅ Copy Trading Logic (Registry & Execution)
- ✅ Events Emission (PositionOpened, CopyTradeExecuted)

---

### 💻 Frontend Package (packages/frontend/)

**Application Status:**
- ✅ **Framework:** React 18 + Vite (Migrated from Next.js plan)
- ✅ **UI Library:** Tailwind CSS + Radix UI
- ✅ **Wallet:** @mysten/dapp-kit (Sui Wallet Integration)
- ✅ **State:** Zustand Global Store

**Pages Implemented:**
- **Dashboard:** Trading Panel, Market Overview, Positions List
- **Leaderboard:** Sortable Trader Rankings, "Copy" Action
- **Components:** Real-time Price Chart, Toast Notifications, Skeletons

---

## 🚀 Deployment Instructions

### Step 1: Backend Deployment (Railway/Render)

1. **Build:**
   ```bash
   cd packages/backend
   pnpm build
   ```

2. **Environment Variables:**
   ```bash
   DATABASE_URL="postgresql://postgres.[ID]:[PWD]@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[ID]:[PWD]@aws-0-region.pooler.supabase.com:5432/postgres" 
   PORT=3001
   SUI_NETWORK="testnet"
   MARGIN_MASTER_PACKAGE_ID="0x361681e0d8b2fdca428a4c4afb9e27af251a0fc3b543e4cb8738d2510a449ca4"
   ```

3. **Start:**
   ```bash
   npm run start
   ```

### Step 2: Smart Contract (Already Deployed)

Contracts are live on Sui Testnet. No further action needed unless upgrading.
- **Package ID:** `0x361681e0d8b2fdca428a4c4afb9e27af251a0fc3b543e4cb8738d2510a449ca4`

### Step 3: Frontend Deployment (Vercel)

1. **Build:**
   ```bash
   cd packages/frontend
   pnpm build
   ```

2. **Environment Variables:**
   ```bash
   VITE_BACKEND_URL="https://your-backend-url.railway.app"
   VITE_SUI_NETWORK="testnet"
   VITE_PACKAGE_ID="0x361681e0d8b2fdca428a4c4afb9e27af251a0fc3b543e4cb8738d2510a449ca4"
   ```

3. **Deploy Output:** `packages/frontend/dist`

---

## 📊 Architecture & Data Flow

### Complete Flow (Verified E2E)
1. **User Action:** User clicks "Long ETH 5x" on Frontend.
2. **Frontend:** Checks wallet balance -> Calls `moveCall` (Sui SDK).
3. **Blockchain:** Contract executes trade -> Emits `PositionOpened` event.
4. **Indexer (Backend):** Detects event via WebSocket subscription.
5. **Database:** Saves Position to Supabase.
6. **Copy Logic:** Backend searches `CopyRelation` table for followers.
7. **Execution:** Backend executes copy trades for followers (if authorized).
8. **UI Update:** Frontend receives update via Socket.IO -> Refreshes Position List.

---

## ✅ Production Readiness Checklist

### Backend
- [x] Database schema & migrations applied
- [x] All API endpoints implemented & tested
- [x] Deployed to Supabase (DB)
- [x] Rate Limiting & Security middleware active
- [x] E2E Verification Script passed

### Smart Contracts
- [x] Core modules implemented
- [x] Compiled & Deployed to Testnet
- [x] Event system verifying correctly
- [ ] Mainnet Deployment (Pending Audit)

### Frontend
- [x] Vite Build Optimized (Code Splitting)
- [x] Wallet Integration Working
- [x] Real-time Price Charts attached
- [x] Mobile Responsive Layout Verified

---

## 🏆 Achievement Summary

**Current Status:** 🎉 **READY FOR DEMO / HACKATHON SUBMISSION**

1. ✅ **Full Loop:** From Wallet Connect -> Trade -> DB Sync -> UI Update.
2. ✅ **User Experience:** Polished UI with Toasts, Skeletons, and Charts.
3. ✅ **Reliability:** Auto-reconnect WebSockets and persistent Indexer cursors.

**Next Immediate Step:** Record Demo Video.
