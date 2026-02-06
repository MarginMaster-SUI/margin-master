# Move Contract Notes

**Last Updated:** 2026-02-06

## Package Info
- **Package:** `margin_master`
- **Edition:** 2024.beta
- **Testnet Package ID (v2):** `0x361681e0d8b2fdca428a4c4afb9e27af251a0fc3b543e4cb8738d2510a449ca4`
- **CopyRelationRegistry:** `0x452e7b7822f255e40f5df3d075d18b292a72cd315502a744598d45fb6f580672`
- **Upgrade Cap:** `0xd46cc06604759215b8a96621ea6e4365decee9cd5bd03ec25f7f5ec2bf1bad0f`
- **Old Package (v1, deprecated):** `0xa769230f609d7e517af140150c409f98b74e2f090bf442e7877d6266b76e0696`

## Modules

### sources/
| Module | Purpose |
|--------|---------|
| `margin_master.move` | Admin cap, registry, entry points |
| `vault.move` | Vault (LP deposits), flash loan (hot potato receipt) |
| `position.move` | Position lifecycle, PnL, liquidation |
| `copy_executor.move` | Copy trade registry, batch execution |
| `events.move` | All event structs & `public(package)` emitters |
| `flash_liquidator.move` | **NEW** Flash-loan-based liquidation module |

### tests/
| Test File | Tests | Status |
|-----------|-------|--------|
| `extreme_tests.move` | 20 tests | All PASS |
| `security_tests.move` | 11 tests | All PASS |
| **Total** | **31 tests** | **All PASS** |

## 2026-02-06 Optimization Summary

### A. Liquidation Mechanism (position.move)
- `liquidate_position<T>()` — anyone can call when loss >= 80% margin
- Liquidator reward: 5% of remaining margin
- `is_liquidatable()`, `get_liquidation_price()` — view helpers
- Constants: `LIQUIDATION_THRESHOLD_BPS = 8000`, `LIQUIDATOR_REWARD_BPS = 500`

### B. Batch Copy Trade (copy_executor.move)
- `batch_execute_copy_trades<T>()` — loops all active followers for a trader, opens positions in one PTB
- `execute_copy_trade` now requires `&CopyRelationRegistry` param and verifies relation exists
- Added `copy_ratio > 0` validation, `deactivate_copy_relation` asserts found
- Added `update_copy_relation()`, `get_active_follower_count()`

### C. Flash Loan (vault.move + flash_liquidator.move)
- `FlashLoanReceipt<phantom T>` — hot potato struct (no abilities)
- `flash_borrow<T>()` → `(Balance<T>, FlashLoanReceipt<T>)`
- `flash_repay<T>()` — consumes receipt, asserts repayment >= borrowed
- `flash_liquidator::flash_liquidate<T>()` — simple seizure pattern
- `flash_liquidator::flash_borrow_liquidate<T>()` — demonstrates full flash loan pattern

### D. Code Quality
- **events.move:** All emit fns changed `public` → `public(package)` (prevents external fake events)
- **position.move:** DRY PnL via `compute_pnl_u128()` helper (was copy-pasted 4x)
- **position.move:** `MIN_MARGIN = 1_000_000` (1 USDC minimum)
- **position.move:** New getters: `margin_value`, `is_closed`, `position_type`
- **vault.move:** New getters: `vault_id`; internal helpers: `borrow_balance_mut`, `decrease_committed_margin`, `increase_available_liquidity`

## Known Issues / Gotchas
- `sui::test_utils::destroy` is deprecated → use `std::unit_test::destroy` (works but warns)
- `#[expected_failure]` tests still need `destroy(_pos)` for compiler type safety even though abort happens before reaching it
- v2 fresh deployed (v1→v2 upgrade failed due to `public→public(package)` + param changes being incompatible)
- Frontend/Backend SDK types differ (frontend @mysten/sui 1.11.0 vs backend 2.1.0)

## TODO
- [x] Redeploy contract to testnet (fresh deploy v2, incompatible upgrade)
- [x] Update frontend `useTradingContract.ts` for new liquidation + batch functions
- [x] Update backend event indexer for new events (BatchCopyTradeExecuted, FlashLiquidation)

## 2026-02-06 Frontend/Backend Integration

### Frontend: `useTradingContract.ts`
Added 3 new functions:
- `liquidatePosition(positionId, currentPrice, vaultId)` → `position::liquidate_position_entry`
- `updateCopyRelation(traderAddress, newCopyRatio, newMaxPositionSize)` → `copy_executor::update_copy_relation`
- `deactivateCopyRelation(traderAddress)` → `copy_executor::deactivate_copy_relation`

### Frontend: `sui-contracts.ts`
- Added event types: `LiquidationEvent`, `BatchCopyTradeExecutedEvent`, `FlashLiquidationEvent`
- Added arg types: `LiquidatePositionArgs`, `UpdateCopyRelationArgs`, `DeactivateCopyRelationArgs`
- Added constants: `FLASH_LIQUIDATOR_MODULE`, `SUI_CLOCK_OBJECT_ID`

### Backend: `blockchain-indexer.ts`
- Added `handleBatchCopyTradeExecuted` — logs batch copy trade summary, notifies trader
- Added `handleFlashLiquidation` — marks position LIQUIDATED, creates trade record, notifies owner
- Registered both in `eventHandlers` polling map

### Fixed: Backend TS errors (2026-02-06)
- `SuiGraphQLClient({ url })` → added `network: SUI_NETWORK` (SDK v2.1.0 requirement)
- All `parsedJson as EventType` → `as unknown as EventType` (double-cast for `Record<string, unknown>`)
- 4 route files: added `: ReturnType<typeof Router>` to fix TS2742 non-portable type inference
- **Backend now compiles with 0 errors**
