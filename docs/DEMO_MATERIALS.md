# MarginMaster - Demo & Submission Materials

## 1. Project Description (Hackathon Submission)

### **Project Name**
MarginMaster

### **Tagline**
Decentralised Social Copy Trading Protocol on Sui

### **Elevator Pitch (Short)**
MarginMaster is a decentralised copy trading platform built on Sui that enables users to automatically mirror the strategies of top-performing on-chain traders in real-time. By combining transparent on-chain execution with a seamless Web2-like experience, we democratise access to institutional-grade trading strategies while maintaining non-custodial security.

### **Long Description (Full Submission)**
**The Problem:**
DeFi trading is complex and intimidating for newcomers. While successful traders generate high yields on-chain, most retail users lack the time, expertise, or tools to replicate these strategies. Existing copy trading solutions are often centralised (custodial risk) or fragmented (poor UX).

**The Solution:**
MarginMaster bridges this gap by creating a trustless, non-custodial copy trading layer on the Sui blockchain.
*   **For Followers:** One-click copy trading. Select a top trader from the leaderboard, set your copy ratio, and let the smart contract handle execution automatically.
*   **For Traders:** Earn performance fees by proving your skills on-chain. Your track record is immutable and verified.

**How it Works:**
1.  **Smart Contracts:** Our Move contracts handle margin logic, leverage (up to 20x), and the "Vault" for fund safety. A novel **Flash Liquidation** mechanism allows capital-efficient position unwinding without liquidators needing upfront funds, and **Batch Copy Execution** optimises gas for multi-follower trades.
2.  **Event Indexer:** A custom backend indexer listens to `PositionOpened` events on Sui and instantly triggers copy trades for all subscribed followers.
3.  **Hybrid Architecture:** We use off-chain indexing for instant UI updates (Leaderboard, Charts) while settlements remain 100% on-chain.

**Tech Stack:**
*   **Blockchain:** Sui Move (Testnet)
*   **Frontend:** React, Vite, Tailwind CSS, Sui dApp Kit, Recharts
*   **Backend:** TypeScript, Express, Prisma, PostgreSQL (Supabase)
*   **Real-time:** Socket.IO, WebSocket

---

## 2. Pitch Deck (12 Slides)

### **Slide 1: Title Slide**
*   Logo: MarginMaster
*   Subtitle: "Follow the Whales. Trade like a Pro."
*   Team: [Your Name / Team Name]
*   Event: ETHGlobal HackMoney 2026

### **Slide 2: The Problem**
*   DeFi trading is broken for retail users. Complex UIs, fragmented liquidity, and information asymmetry create an uneven playing field.
*   **90% of retail traders lose money** — not because markets are unpredictable, but because they lack the tools and expertise that professional traders have.
*   Existing copy trading solutions (Bitget, Bybit) are **centralised and custodial** — users surrender control of their funds and trust opaque performance metrics.
*   The gap: "I want to trade profitably, but I don't know *what* or *when* to buy — and I don't want to trust a centralised exchange with my keys."

### **Slide 3: The Solution**
*   **MarginMaster**: Decentralised Social Copy Trading on Sui.
*   **Transparency:** Every trader's track record is verified on-chain. No fake PnL screenshots — immutable, auditable performance history.
*   **Simplicity:** "Click to Copy" — select a top trader, set your copy ratio, and the smart contract mirrors their trades automatically.
*   **Non-Custodial:** Your funds stay in your wallet. You sign every transaction. Full self-custody, zero counterparty risk.
*   **Aligned Incentives:** Top traders earn 10% of follower profits, motivating them to maintain strong performance.

### **Slide 4: Product Demo (Video/GIF)**
*   Embed 3-minute demo video or animated GIF walkthrough.
*   Key screens: Dashboard → Leaderboard → Copy Modal → Auto-execution → Close Position.

### **Slide 5: Key Features**
*   **Leverage Trading:** Up to 20x Long/Short with real-time liquidation price calculation and risk indicators.
*   **One-Click Copy Trading:** <500ms latency between Master and Follower trades via Sui's sub-second finality.
*   **Flash Liquidation:** Novel capital-efficient liquidation using hot-potato pattern — liquidators need zero upfront capital, earning 5% reward.
*   **Batch Copy Execution:** Gas-optimised multi-follower trade execution in a single transaction.
*   **Smart Leaderboard:** Rankings by PnL, Win Rate, Trade Count, and Follower Count — all derived from on-chain data.
*   **Real-Time Price Charts:** Interactive charts with 1H/4H/1D/1W timeframes and live WebSocket price feeds.

### **Slide 6: Architecture**
```
┌─────────────────────────────────────────────────────────┐
│                      USER (Browser)                     │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │ Dashboard │  │ Leaderboard│  │ Sui Wallet (dApp Kit)│ │
│  └─────┬────┘  └─────┬──────┘  └──────────┬───────────┘ │
└────────┼─────────────┼─────────────────────┼────────────┘
         │ REST API     │ REST API            │ Sign Tx
         ▼             ▼                     ▼
┌─────────────────────────────┐    ┌──────────────────────┐
│     Backend (Express.js)    │    │   Sui Blockchain     │
│  ┌───────────┐ ┌──────────┐ │    │  ┌────────────────┐  │
│  │ API Routes│ │Socket.IO │ │    │  │ margin_master  │  │
│  │ (7 routes)│ │(realtime)│ │    │  │   Package      │  │
│  └───────────┘ └──────────┘ │    │  ├────────────────┤  │
│  ┌───────────┐ ┌──────────┐ │    │  │ trading.move   │  │
│  │  Prisma   │ │  Event   │◄┼────┤  │ copy_executor  │  │
│  │   ORM     │ │ Indexer  │ │    │  │ flash_liquidate│  │
│  └─────┬─────┘ └──────────┘ │    │  │ vault.move     │  │
└────────┼────────────────────┘    │  └────────────────┘  │
         ▼                         └──────────────────────┘
┌─────────────────────────────┐
│  Supabase (PostgreSQL)      │
│  7 models, seeded demo data │
└─────────────────────────────┘
```
*   **Highlight:** Sui's sub-second finality makes real-time copy trading possible. The Event Indexer captures on-chain events and triggers copy execution within milliseconds.

### **Slide 7: Why Sui?**
*   **Sub-second finality** is crucial for preventing slippage in copy trades. When a master trader opens a position, followers must execute at nearly the same price.
*   **Object-based model** allows efficient Position tracking — each position is a distinct on-chain object with its own lifecycle, enabling granular control.
*   **Low gas fees** make high-frequency trading and batch copy execution economically viable — critical for a protocol that multiplies transactions per trade.
*   **Move language safety** provides strong guarantees around asset handling — hot-potato pattern enables our flash liquidation without re-entrancy risk.

### **Slide 8: Competitive Advantage**

| Feature | CEX Copy Trading (Bitget/Bybit) | MarginMaster |
|---------|--------------------------------|--------------|
| Custody | Centralised (exchange holds funds) | **Non-custodial (self-custody)** |
| Transparency | Opaque metrics, editable history | **On-chain verified, immutable** |
| Trust Model | Trust the exchange | **Trust the code (smart contracts)** |
| Censorship | Can freeze accounts/funds | **Permissionless** |
| Fees | Platform takes large cut | **Transparent: 0.05% + 10% profit share** |
| Latency | Fast (internal matching) | **<500ms (Sui sub-second finality)** |
| Liquidation | Traditional (requires capital) | **Flash liquidation (zero capital)** |
| Composability | Walled garden | **Open protocol, composable DeFi** |

### **Slide 9: Business Model**
*   **Protocol Fee:** 0.05% per trade volume — sustainable, competitive with DEX norms.
*   **Profit Share:** 10% of Follower profits go to the Master Trader — creates aligned incentives where traders are rewarded for genuine performance.
*   **Future Revenue:** Premium analytics, strategy marketplace, cross-chain bridge fees.

### **Slide 10: Roadmap**
*   **Phase 1 (Now):** Core copy trading on Sui Testnet. Leverage trading, leaderboard, flash liquidation.
*   **Phase 2 (Q3 2026):** Mainnet launch. Token incentives for early traders and followers. Advanced analytics dashboard.
*   **Phase 3 (Q4 2026):** Cross-chain copy trading via Wormhole. Strategy marketplace where traders can monetise their algorithms.
*   **Phase 4 (2027):** DAO governance. Protocol-owned liquidity. Institutional API access.

### **Slide 11: Team**
*   **[Your Name]** — Full-stack developer & blockchain engineer. Built the entire MarginMaster stack from smart contracts to frontend.
*   [Add team members as needed]
*   Built at ETHGlobal HackMoney 2026.

### **Slide 12: Call to Action**
*   "Democratising DeFi trading, one copy at a time."
*   **Try it:** https://sui-margin-master.vercel.app
*   **Code:** https://github.com/[your-repo]/margin-master
*   **Contracts:** Sui Testnet `0x3616...ca4`
*   Twitter / Contact: [your handles]

---

## 3. Demo Video Script (3-Minute Flow)

### Recording Setup Checklist
- [ ] Browser: Chrome, 1920×1080, 100% zoom, no extensions visible
- [ ] Clear browser history / use incognito for clean URL bar
- [ ] Sui Wallet extension installed and connected to Testnet
- [ ] Backend running and healthy: `https://margin-master-backend-prd.up.railway.app/health`
- [ ] Frontend loaded: `https://sui-margin-master.vercel.app`
- [ ] Verify seed data: Leaderboard shows 5 traders with stats
- [ ] Recording tool: Loom / OBS at 1080p 60fps
- [ ] Microphone test: clear audio, no background noise
- [ ] Close all notifications, Slack, etc.

### **Scene 1: Introduction (0:00 - 0:30)**
*   **Visual:** Opening title card → MarginMaster Dashboard landing page.
*   **UI Actions:**
    1. Show the Dashboard with hero banner: "Follow Top Traders. Copy Their Success."
    2. Point out the three feature cards: Leverage Trading, Copy Trading, Leaderboard.
    3. Scroll down to MarketOverview — show SUI/USDC, BTC/USDC, ETH/USDC with live prices updating.
*   **Voiceover:** "Welcome to MarginMaster, the first decentralised copy trading protocol on Sui. Today, we're showing you how anyone can replicate the success of top on-chain traders — transparently, trustlessly, and with full self-custody."

### **Scene 2: Price Chart & Trading (0:30 - 1:00)**
*   **Visual:** Click on SUI/USDC market card → PriceChart appears.
*   **UI Actions:**
    1. Show the PriceChart with live price line (green gradient for uptrend).
    2. Click through timeframes: 1H → 4H → 1D → 1W — show chart updating.
    3. Scroll to TradingPanel below the chart.
    4. Select "Long", enter Margin: 500 USDC, set Leverage to 10x.
    5. **Highlight:** Show the leverage risk indicator changing colour (green → yellow → red as leverage increases).
    6. **Highlight:** Show the estimated liquidation price updating in real-time.
    7. Optionally set Stop Loss / Take Profit — show validation (SL must be below entry for Long).
*   **Voiceover:** "Our trading interface gives you professional-grade tools — interactive price charts with multiple timeframes, real-time risk indicators, and instant liquidation price calculation. Everything you need to trade with confidence."

### **Scene 3: Leaderboard & Discovery (1:00 - 1:30)**
*   **Visual:** Click "Leaderboard" in the navigation bar.
*   **UI Actions:**
    1. Show the Leaderboard loading with skeleton animation → data appears.
    2. Show the sort buttons: click "PnL" → "Win Rate" → "Trades" to show re-sorting.
    3. Hover over "CryptoWhale" — highlight their 72% Win Rate and +$48k PnL.
    4. Point out follower counts and total trades for social proof.
*   **Voiceover:** "Our Leaderboard ranks traders based on real, verifiable on-chain history. No fake screenshots — every stat is derived from actual blockchain transactions. Here we see 'CryptoWhale' is crushing the market with a 72% win rate."

### **Scene 4: Enabling Copy Trade (1:30 - 2:15)**
*   **Visual:** Click the "Copy" button on CryptoWhale's row.
*   **UI Actions:**
    1. CopyTradeModal appears with trader info (avatar, name, stats).
    2. Enter Copy Ratio: slide to 10% (meaning: if they trade 1 BTC, I trade 0.1 BTC).
    3. Enter Max Position Size: $1000 USDC (risk management cap).
    4. Click "Confirm Copy".
    5. **Crucial:** Sui Wallet popup appears → click "Approve" to sign the transaction.
    6. Success Toast notification appears: "Successfully started copying CryptoWhale!"
*   **Voiceover:** "I can follow this trader in seconds. Set a copy ratio for proportional mirroring, define a maximum position size for risk management, sign via my Sui Wallet — and that's it. Smart contracts now automatically link my portfolio to theirs. My funds never leave my wallet."

### **Scene 5: Auto-Execution & Control (2:15 - 3:00)**
*   **Visual:** Navigate back to Dashboard.
*   **UI Actions:**
    1. Show the PositionsList section (may be empty or have existing positions).
    2. (Simulated) A new position appears in "My Positions" — auto-copied from CryptoWhale.
    3. Show the position card with entry price, current PnL, leverage, and liquidation price.
    4. Click "Close Position" on the copied trade.
    5. Confirm the close transaction in Sui Wallet.
    6. Toast: "Position closed successfully!"
    7. **(If on mobile)** Briefly resize browser to show responsive card layout.
*   **Voiceover:** "Look — the Master Trader just opened a Long on ETH, and my account automatically mirrored that trade instantly, proportional to my settings. No manual intervention. But I retain full control — I can exit any copy trade or close specific positions whenever I want. MarginMaster gives you the expertise of a whale, with the control of self-custody. Built on Sui, powered by flash liquidation and batch execution for maximum capital efficiency."

### **Tech Talking Points (weave into voiceover as appropriate):**
- Flash Liquidation: "Our novel flash liquidation mechanism uses Sui's hot-potato pattern — liquidators need zero upfront capital, making the protocol more resilient."
- Batch Copy Execution: "When a master trader acts, all followers execute in a single batch transaction, optimising gas costs."
- Sub-second finality: "Sui's <1s finality means copy trades execute at virtually the same price as the master's trade."

---

## 4. Hackathon Submission Checklist (ETHGlobal)

### Required Fields

| Field | Status | Content / Notes |
|-------|--------|----------------|
| **Project Name** | ✅ Ready | MarginMaster |
| **Tagline** | ✅ Ready | "Decentralised Social Copy Trading Protocol on Sui" |
| **Short Description** | ✅ Ready | See Elevator Pitch above |
| **Long Description** | ✅ Ready | See Section 1 Long Description |
| **Tech Stack** | ✅ Ready | Sui Move, React, Vite, Express, Prisma, Supabase, Socket.IO |
| **Demo Video URL** | ⏳ Pending | Record 3-min video → upload to YouTube/Loom |
| **Live Demo URL** | ✅ Ready | https://sui-margin-master.vercel.app |
| **GitHub Repo** | ✅ Ready | Link to repo (ensure public or judges have access) |
| **Presentation / Pitch Deck** | ⏳ Pending | Create slides from Section 2 → upload PDF / Google Slides link |
| **Team Members** | ⏳ Pending | Add ETHGlobal profile links |
| **Tracks / Bounties** | ⏳ Pending | Select: Sui track, DeFi track, Best UX (if available) |
| **Smart Contract Addresses** | ✅ Ready | Package: `0x361681e0d8b2fdca428a4c4afb9e27af251a0fc3b543e4cb8738d2510a449ca4` |
| **Screenshots** | ⏳ Pending | Capture: Dashboard, Leaderboard, CopyModal, PriceChart, Mobile view |

### Pre-Submission Verification
- [ ] Live demo URL loads without errors
- [ ] Backend health check returns 200
- [ ] Leaderboard displays seeded trader data
- [ ] WebSocket prices are updating in real-time
- [ ] Wallet connection works (Sui Wallet / Suiet)
- [ ] GitHub README has setup instructions
- [ ] No `.env` or secrets committed to repo
- [ ] Demo video is publicly accessible
- [ ] All submission fields are filled in
