# Tyche — On-Chain Prediction Market Reputation Protocol

> **"Your on-chain prediction identity."**

Built for the **Somnia Reactivity Mini Hackathon 2026**.

Tyche is a fully on-chain reputation system for prediction market participants on the Somnia blockchain. Every prediction you make, every market you resolve, every tier you reach — all scored, tracked, and reflected in a live Soulbound Token (SBT) that evolves automatically using **Somnia Reactivity**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER / BROWSER                         │
│              Next.js 14 + wagmi + RainbowKit                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST + WebSocket (Socket.io)
┌──────────────────────────▼──────────────────────────────────────┐
│                      BACKEND (Node.js/Fastify)                  │
│   REST API · Socket.io · Event Indexer · Redis Cache · SIWE    │
│                      PostgreSQL Database                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ ethers.js event subscriptions
┌──────────────────────────▼──────────────────────────────────────┐
│                    SOMNIA BLOCKCHAIN (Chain ID 50312)           │
│                                                                 │
│  MockPredictionMarket ──► TycheMarketAdapter                   │
│                                │                               │
│                    [Somnia Reactivity Event]                    │
│                                │                               │
│                    TycheScoreRegistry ◄──── TycheSeasonManager  │
│                                │                               │
│                    [Somnia Reactivity Event]                    │
│                                │                               │
│                         TycheSBT (ERC-5192)                    │
│                                │                               │
│                    [Somnia Reactivity Event]                    │
│                                │                               │
│                          TycheSocial                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## How Somnia Reactivity Powers Tyche

Somnia Reactivity is the core mechanic — **zero manual triggers, everything happens automatically on-chain**.

### The 5-Step Reactive Flow

```
Step 1 ──► User resolves a prediction on MockPredictionMarket
           └─ emits: PredictionResolved(wallet, marketId, result, pnl)

Step 2 ──► TycheMarketAdapter (Reactive Listener)
           └─ normalises the event → emits: PredictionResolved (standard)

Step 3 ──► TycheScoreRegistry (Reactive Listener to MarketAdapter)
           └─ recalculates all 5 score dimensions automatically
           └─ checks if tier changed → emits: ScoreUpdated, TierChanged

Step 4 ──► TycheSBT (Reactive Listener to ScoreRegistry)
           └─ if tier changed → calls evolve() automatically
           └─ SBT metadata URI updates → emits: SBTEvolved

Step 5 ──► TycheSocial (Reactive Listener to MarketAdapter)
           └─ alerts followers of the actor → emits: PositionAlert
```

**Somnia Reactivity CRON**: `TycheScoreRegistry` also uses Somnia's on-chain cron (every 1000 blocks) to apply a 2% score decay for inactive wallets — demonstrating both Reactive events AND cron in one protocol.

---

## Smart Contracts (Somnia Testnet)

| Contract | Address |
|---|---|
| TycheMarketAdapter | `0x3728Df6fF0cCcEeFd6E98c88beeCfc308Af4F1E4` |
| TycheScoreRegistry | `0x90ab2482E83BE7A1Ae550b8C789bc6701267adA0` |
| TycheSeasonManager | `0x2720aE609232892118aDC314f44679dB13F50267` |
| MockPredictionMarket | `0xA278c23F935980d903E8Da3d25379b2B5Ec3D16a` |
| TycheSBT | TBD |
| TycheSocial | TBD |

Explorer: [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network)

---

## Tyche Score — 5 Dimensions

| Dimension | Scale | Formula |
|---|---|---|
| **Accuracy** | 0–200 | `(wins / total) × difficulty_multiplier` |
| **Alpha** | 0–200 | Entry timing vs odds movement delta |
| **Calibration** | 0–200 | Brier Score adaptation |
| **Consistency** | 0–200 | Sharpe-like ratio over rolling 20-prediction window |
| **Category Mastery** | 0–100 per category | Weighted win rate per category tag |
| **Composite** | 0–1000 | Weighted sum of all dimensions |

**Tiers**: Bronze → Silver → Gold → Platinum → Oracle (based on composite score thresholds)

---

## Tech Stack

| Layer | Stack |
|---|---|
| Smart Contracts | Solidity + Hardhat + Somnia Reactivity SDK |
| Backend | Node.js + Fastify v4 + PostgreSQL + Redis + Socket.io |
| Frontend | Next.js 14 + TypeScript + Tailwind + wagmi v2 + viem + RainbowKit |
| Indexer | Custom ethers v6 event listener on Somnia RPC |

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- A wallet with Somnia testnet STT (get from [Somnia faucet](https://testnet.somnia.network))

### 1. Clone & Install

```bash
git clone https://github.com/your-org/tyche.git
cd tyche

# Install contracts deps
cd contracts && npm install

# Install backend deps
cd ../backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env — set DATABASE_URL, REDIS_URL, JWT_SECRET

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local — set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

### 3. Run Database Migrations

```bash
cd backend && npm run migrate
```

### 4. Start Services

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Frontend: http://localhost:3000
Backend API: http://localhost:3001
Health check: http://localhost:3001/health

### 5. Smart Contracts (optional, already deployed)

```bash
cd contracts

# Run tests
npm test

# Deploy (only if redeploying)
npx hardhat run scripts/deploy.js --network somnia
```

---

## Deployment

### Frontend → Vercel

1. Connect GitHub repo to [Vercel](https://vercel.com)
2. Set root directory to `frontend`
3. Add environment variables (see `frontend/.env.example`)
4. Deploy — Vercel auto-detects Next.js

### Backend → Railway

1. Connect GitHub repo to [Railway](https://railway.app)
2. Add PostgreSQL and Redis plugins
3. Set root directory to `backend`
4. Add environment variables (see `backend/.env.example`, `backend/railway.toml`)
5. **Enable sticky sessions** for Socket.io under Settings → Networking

### Backend → Render (alternative)

```bash
# render.yaml is preconfigured at backend/render.yaml
# Connect repo, select backend/ as root, deploy
```

---

## Deployed App

Frontend: **TBD** (deploying to Vercel)
Backend: **TBD** (deploying to Railway)

---

## Project Structure

```
tyche/
├── contracts/          # Solidity smart contracts (Hardhat)
│   ├── contracts/      # TycheMarketAdapter, ScoreRegistry, SBT, etc.
│   ├── test/           # 97 passing Hardhat tests
│   └── scripts/        # Deployment scripts
├── backend/            # Node.js API + indexer
│   ├── src/
│   │   ├── routes/     # profile, leaderboard, seasons, social, sbt, stats
│   │   ├── indexer/    # Somnia event listener
│   │   ├── websocket/  # Socket.io rooms + emit helpers
│   │   ├── services/   # Redis cache, ENS resolution
│   │   └── middleware/ # SIWE + JWT auth
│   └── railway.toml    # Railway deployment config
├── frontend/           # Next.js 14 app
│   ├── src/app/        # Pages: /, /leaderboard, /profile, /feed, /sbt, etc.
│   ├── src/components/ # UI, profile, leaderboard, landing, sbt components
│   ├── src/hooks/      # useSocket, useProfile, useLeaderboard, useNotifications
│   └── vercel.json     # Vercel deployment config
└── docs/               # PRD and design docs
```

---

## Somnia Testnet

- **RPC**: https://dream-rpc.somnia.network
- **Chain ID**: 50312
- **Explorer**: https://shannon-explorer.somnia.network

---

## Hackathon: Somnia Reactivity Mini Hackathon 2026

Judging criteria addressed:

| Criterion | Implementation |
|---|---|
| **Technical Excellence** | 5 reactive contracts, 97 tests, full-stack |
| **Real-Time UX** | Socket.io leaderboard reorder, live feed, toast notifications |
| **Somnia Integration** | All contracts deployed on Somnia testnet, Reactivity SDK used |
| **Potential Impact** | First reputation layer for any prediction market on Somnia |

---

*Built with Somnia Reactivity — Fully On-Chain, Zero Backend Triggers.*
