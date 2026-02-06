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
1.  **Smart Contracts:** Our Move contracts handle margin logic, leverage (up to 20x), and the "Vault" for fund safety.
2.  **Event Indexer:** A custom backend indexer listens to `PositionOpened` events on Sui and instantly triggers copy trades for all subscribed followers.
3.  **Hybrid Architecture:** We use off-chain indexing for instant UI updates (Leaderboard, Charts) while settlements remain 100% on-chain.

**Tech Stack:**
*   **Blockchain:** Sui Move (Testnet)
*   **Frontend:** React, Vite, Tailwind CSS, Sui dApp Kit
*   **Backend:** TypeScript, Express, Prisma, PostgreSQL (Supabase)
*   **Real-time:** Socket.IO, WebSocket

---

## 2. Pitch Deck Outline (10 Slides)

**Slide 1: Title Slide**
*   Logo: MarginMaster
*   Subtitle: "Follow the Whales. Trade like a Pro."
*   Team Name

**Slide 2: The Problem**
*   DeFi is hard: Fragmentation, complex UIs, high barrier to entry.
*   90% of retail traders lose money.
*   "I want to trade, but I don't know *what* or *when* to buy."

**Slide 3: The Solution**
*   **MarginMaster**: Social Copy Trading on Sui.
*   Transparency: Verify trader performance on-chain.
*   Simplicity: "Click to Copy".
*   Non-Custodial: You always verify your funds.

**Slide 4: Product Demo (Video/GIF)**
*   Show relevant screenshots: Leaderboard -> Modal -> Success Toast.

**Slide 5: Key Features**
*   **Hybrid Leverage:** Up to 20x Long/Short.
*   **Real-Time Sync:** <500ms latency between Master and Follower trades.
*   **Leaderboard:** Ranking by PnL, Win Rate, and Consistency (Sharpe Ratio).

**Slide 6: Architecture**
*   Diagram showing: User -> Frontend -> Sui Contract -> Event -> Indexer -> Copy Execution.
*   Highlight: "Sui's low latency makes real-time copy trading possible."

**Slide 7: Why Sui?**
*   Sub-second finality is crucial for preventing slippage in copy trades.
*   Object-based model allows efficient "Position" tracking.
*   Low gas fees make high-frequency trading viable.

**Slide 8: Business Model**
*   **Protocol Fee:** 0.05% per trade volume.
*   **Profit Share:** 10% of Follower profits go to the Master Trader (automating the incentive).

**Slide 9: Roadmap**
*   **Ph1 (Now):** Basic Copy Trading on Testnet.
*   **Ph2 (Q3 2026):** Mainnet Launch + Token incentives.
*   **Ph3 (Q4 2026):** Cross-chain copying (via Wormhole).

**Slide 10: Call to Action**
*   "Join us in democratising DeFi trading."
*   Links: GitHub, Demo URL, Twitter.

---

## 3. Demo Video Script (3-Minute Flow)

**Scene 1: Introduction (0:00 - 0:30)**
*   **Visual:** Opening Title -> MarginMaster Landing Page.
*   **Voiceover:** "Welcome to MarginMaster, the first seamless copy trading protocol on Sui. Today, we're showing you how anyone can replicate the success of top on-chain traders transparently and trustlessly."

**Scene 2: Leaderboard & Discovery (0:30 - 1:00)**
*   **Visual:** Click "Leaderboard". Scroll through the list of traders (CryptoWhale, DeFiKing).
*   **Action:** Hover over "CryptoWhale". Show their 72% Win Rate and +$48k PnL.
*   **Voiceover:** "Our Leaderboard ranks traders based on real, verifiable on-chain history. Here we see 'CryptoWhale' is crushing the market. Let's inspect their stats."

**Scene 3: Enabling Copy Trade (1:00 - 1:45)**
*   **Visual:** Click "Copy" button on CryptoWhale.
*   **Action:** The Copy Modal appears.
    *   Enter Amount: $1000 USDC.
    *   Select Copy Ratio: 10% (If they trade 1 BTC, I trade 0.1 BTC).
    *   Click "Confirm Copy".
    *   **Crucial:** Show the Wallet Transaction Popup -> Approve.
    *   Show "Success" Toast.
*   **Voiceover:** "I can follow this trader in seconds. I set a simple copy ratio, sign the transaction via my Sui Wallet, and that's it. Smart contracts now link my portfolio to theirs."

**Scene 4: Execution (Simulated) (1:45 - 2:30)**
*   **Visual:** Switch to Dashboard.
*   **Action:** (Behind operations, simulating Master Trader opening a position).
*   **Visual:** Suddenly, a new Position appears in the "My Positions" list.
*   **Voiceover:** "And look! The Master Trader just opened a Long on ETH. My account automatically mirrored that trade instantly, proportional to my settings. No manual intervention required."

**Scene 5: Closing & PnL (2:30 - 3:00)**
*   **Visual:** Click "Close Position" to take profit manually.
*   **Action:** Confirm transaction. Position moves to History.
*   **Voiceover:** "I retain full control. I can exit any copy trade or close specific positions whenever I want. MarginMaster gives you the expertise of a whale, with the control of self-custody. Built on Sui."
