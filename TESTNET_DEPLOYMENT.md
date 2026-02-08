# MarginMaster Testnet Deployment Information

**Deployment Date:** 2026-02-04 | **Last Upgrade:** 2026-02-08
**Network:** SUI Testnet
**Status:** ✅ DEPLOYED AND ACTIVE (TradingBot Integrated)

---

## 📦 Deployed Package

**Current Package ID (v3 - TradingBot enabled):**
```
0xd3eef0b924f1699e54ef550515e44668269d0b102f20577067db1a2d2ad6c4f5
```

**Upgrade Transaction:**
```
6XS1vneXSoikeSbF2J7nhk6xZpCY78h8QJbajq7u4QFa
```

**Explorer URL:**
```
https://testnet.suivision.xyz/package/0xd3eef0b924f1699e54ef550515e44668269d0b102f20577067db1a2d2ad6c4f5
```

<details>
<summary>Previous Versions</summary>

**v2 Package ID:**
```
0x361681e0d8b2fdca428a4c4afb9e27af251a0fc3b543e4cb8738d2510a449ca4
```

**v1 Transaction:**
```
5Rz4eazhDP3B6DQy775DXweSTdsss2G92xdmp924kQ3s
```

</details>

---

## 🔑 Important Object IDs

### Shared Objects

**CopyRelationRegistry (Shared):**
```
0x452e7b7822f255e40f5df3d075d18b292a72cd315502a744598d45fb6f580672
```
- Used for managing copy trading relationships (legacy delegated execution)
- Shared object - accessible by all users

**TradingBotRegistry (Shared):**
```
0x8e6259b5b745e2458d7ea67e78db20e07cc0c3d49ad662692b5e325a9b50ec51
```
- New registry for TradingBot automated copy trading
- Tracks follower bots per trader
- Created: 2026-02-08 via `create_registry()` (TX: BHikuYciAY7RqbiazE5xHwx9kDkWKeyU6CC644yT9SRN)

**UpgradeCap (Owned):**
```
0xd46cc06604759215b8a96621ea6e4365decee9cd5bd03ec25f7f5ec2bf1bad0f
```
- Package upgrade capability
- Allows future contract upgrades

---

## 📚 Deployed Modules

| Module | Purpose | Entry Functions |
|--------|---------|----------------|
| **events** | Event emission for backend sync (7 event types) | - |
| **vault** | USDC fund custody + flash loans | `create_vault`, `deposit_entry`, `withdraw_entry` |
| **position** | Margin trading positions + liquidation | `open_position_entry`, `close_position_entry`, `liquidate_position_entry` |
| **copy_executor** | Delegated copy trading (legacy) | `add_copy_relation`, `deactivate_copy_relation`, `update_copy_relation`, `execute_copy_trade_entry` |
| **trading_bot** | ⭐ Automated copy trading with 5-layer security | `create_registry`, `create_trading_bot`, `deposit`, `activate_bot`, `execute_copy_trade`, `destroy_bot` |
| **flash_liquidator** | Capital-free liquidation via flash loans | `flash_liquidate`, `flash_borrow_liquidate` |

---

## 🎯 Event Types for Indexer

The backend event indexer listens for these events:

1. **PositionOpened**
   - Type: `{PACKAGE_ID}::events::PositionOpened`
   - Emitted when: User opens LONG/SHORT position
   - Triggers: Database position creation, copy trade checks

2. **PositionClosed**
   - Type: `{PACKAGE_ID}::events::PositionClosed`
   - Emitted when: Position closed with PnL
   - Triggers: Position status update, trade record creation

3. **CopyTradeExecuted**
   - Type: `{PACKAGE_ID}::events::CopyTradeExecuted`
   - Emitted when: Follower position created
   - Triggers: Follower position creation, notification

4. **Liquidation**
   - Type: `{PACKAGE_ID}::events::Liquidation`
   - Emitted when: Position liquidated (loss >= 80% margin)
   - Triggers: Position liquidation, loss recording

5. **BatchCopyTradeExecuted**
   - Type: `{PACKAGE_ID}::events::BatchCopyTradeExecuted`
   - Emitted when: Multiple followers copied in single PTB
   - Triggers: Trader notification with follower count

6. **FlashLiquidation**
   - Type: `{PACKAGE_ID}::events::FlashLiquidation`
   - Emitted when: Position flash-liquidated (zero-capital)
   - Triggers: Position status update, liquidator reward tracking

7. **BotCopyTradeExecuted** ⭐ New in v3
   - Type: `{PACKAGE_ID}::events::BotCopyTradeExecuted`
   - Emitted when: TradingBot executes automated copy trade
   - Triggers: Bot position tracking, security validation logging

---

## 💰 Gas Costs

**Deployment Cost:** 51.53 SUI
**Estimated Transaction Costs:**
- Open Position: ~0.01-0.02 SUI
- Close Position: ~0.01 SUI
- Add Copy Relation: ~0.005 SUI
- Execute Copy Trade: ~0.02 SUI

---

## 🔧 Backend Integration

**Environment Configuration:**

```bash
# packages/backend/.env
SUI_NETWORK="testnet"
MARGIN_MASTER_PACKAGE_ID="0x361681e0d8b2fdca428a4c4afb9e27af251a0fc3b543e4cb8738d2510a449ca4"
COPY_RELATION_REGISTRY_ID="0x452e7b7822f255e40f5df3d075d18b292a72cd315502a744598d45fb6f580672"
```

**Start the Event Indexer:**

```bash
cd packages/backend
pnpm add -D tsx  # If not already installed
pnpm dev  # Starts the blockchain event indexer
```

---

## 🧪 Testing Instructions

### 1. Create a Vault (USDC custody)

```bash
sui client call \
  --package 0x5f419349ecde88dde843944880e9975ea9f7e63dcc45a602cdef2a2e9a325283 \
  --module vault \
  --function create_vault \
  --type-args 0x2::sui::SUI \
  --gas-budget 10000000
```

### 2. Open a Position

```bash
sui client call \
  --package 0x5f419349ecde88dde843944880e9975ea9f7e63dcc45a602cdef2a2e9a325283 \
  --module position \
  --function open_position_entry \
  --type-args 0x2::sui::SUI \
  --args <vault_object_id> \
         "0x4254432f55534443" \
         0 \
         50000000000 \
         100000000 \
         5 \
         20000000 \
         <clock_object_id> \
  --gas-budget 20000000
```

### 3. Add Copy Relation

```bash
sui client call \
  --package 0x5f419349ecde88dde843944880e9975ea9f7e63dcc45a602cdef2a2e9a325283 \
  --module copy_executor \
  --function add_copy_relation \
  --args 0x52b1eb4f9449680ac00d90954a33563f09a7baf13b8b866564624db9f540701f \
         <trader_address> \
         <follower_address> \
         5000 \
         1000000000 \
  --gas-budget 10000000
```

---

## 📊 Monitoring

**Check Events:**
```bash
sui client events \
  --package 0x5f419349ecde88dde843944880e9975ea9f7e63dcc45a602cdef2a2e9a325283
```

**View Package Details:**
```bash
sui client object \
  0x5f419349ecde88dde843944880e9975ea9f7e63dcc45a602cdef2a2e9a325283
```

---

## 🎯 Next Steps

1. ✅ **Contracts Deployed** - Complete!
2. ✅ **Backend Configured** - `.env` updated
3. ⏭️ **Start Event Indexer** - Run `pnpm dev` in backend/
4. ⏭️ **Build Frontend** - Create Next.js app
5. ⏭️ **Integration Testing** - Test full flow end-to-end

---

## 🔗 Useful Links

- **Testnet Explorer:** https://testnet.suivision.xyz/
- **Testnet Faucet:** https://discord.com/channels/916379725201563759/971488439931392130
- **SUI Documentation:** https://docs.sui.io/
- **Package:** https://testnet.suivision.xyz/package/0x5f419349ecde88dde843944880e9975ea9f7e63dcc45a602cdef2a2e9a325283

---

**Deployed by:** Ralph Loop - MarginMaster Team
**Contact:** Check project README for details
