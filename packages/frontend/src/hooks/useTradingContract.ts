import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { bcs } from '@mysten/sui/bcs'
import { CONTRACT_ADDRESSES, POSITION_TYPE, USDC_TYPE } from '@/types/sui-contracts'

const VAULT_TYPE = `${CONTRACT_ADDRESSES.PACKAGE_ID}::vault::Vault<${USDC_TYPE}>`

export function useTradingContract() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()

  /** Find user's existing Vault<USDC> object ID, or null */
  const findVault = async (owner: string): Promise<string | null> => {
    const res = await suiClient.getOwnedObjects({
      owner,
      filter: { StructType: VAULT_TYPE },
      options: { showContent: true },
    })
    return res.data[0]?.data?.objectId ?? null
  }

  /**
   * Open position in a single PTB:
   * 1. If no vault → create_vault
   * 2. Split USDC coin → deposit into vault
   * 3. Call open_position_entry
   */
  const openPosition = async (args: {
    tradingPair: string
    positionType: 'LONG' | 'SHORT'
    entryPrice: number
    quantity: number
    leverage: number
    margin: number // in USDC display units (e.g. 10 = 10 USDC)
  }) => {
    if (!account) throw new Error('Wallet not connected')

    const marginBase = Math.floor(args.margin * 1_000_000)
    const tx = new Transaction()
    tx.setSender(account.address)

    // --- Vault ---
    // Force refresh check for existing vault (user may have created in another session)
    let existingVaultId = await findVault(account.address)
    let vaultArg: ReturnType<typeof tx.object>

    if (existingVaultId) {
      vaultArg = tx.object(existingVaultId)
    } else {
      // create_vault returns nothing (transfers to sender), so we need a 2-step approach:
      // Call create_vault first, then in a separate TX...
      // Actually create_vault is entry and transfers internally. We can't use the result.
      // So we must check if vault exists first. If not, create it in a prior TX.
      const createTx = new Transaction()
      createTx.moveCall({
        target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.VAULT_MODULE}::create_vault`,
        typeArguments: [USDC_TYPE],
      })
      const createResult = await signAndExecute({ transaction: createTx as any })

      // Validate transaction succeeded
      if (!createResult.digest) {
        throw new Error('Vault creation transaction failed - check wallet for details')
      }

      console.log('Vault creation TX sent:', createResult.digest)

      // Wait for indexer with increased retry window
      let retries = 15 // Increased from 5 to 15
      while (retries > 0 && !existingVaultId) {
        await new Promise((r) => setTimeout(r, 2000)) // Increased from 1s to 2s
        existingVaultId = await findVault(account.address)
        retries--
      }

      if (!existingVaultId) {
        // Verify TX status to distinguish TX failure vs indexer lag
        try {
          const txBlock = await suiClient.getTransactionBlock({ digest: createResult.digest! })

          if (txBlock.effects?.status?.status === 'success') {
            // TX succeeded but indexer lag - this is the most likely case
            throw new Error(
              `Vault created successfully but not indexed yet. ` +
                `Please wait 30-60 seconds and try again. TX: ${createResult.digest?.slice(0, 10)}...`,
            )
          } else {
            // TX failed on-chain
            const errorMsg = txBlock.effects?.status?.error || 'Unknown error'
            throw new Error(`Vault creation failed: ${errorMsg}. TX: ${createResult.digest?.slice(0, 10)}...`)
          }
        } catch (queryError: any) {
          // Re-throw our custom messages
          if (queryError.message?.includes('Vault created successfully') || queryError.message?.includes('Vault creation failed')) {
            throw queryError
          }
          // If getTransactionBlock API fails, assume indexer lag (TX has digest = submitted)
          throw new Error(
            `Vault transaction submitted but status pending. ` +
              `Please wait 30-60 seconds and try again. TX: ${createResult.digest?.slice(0, 10)}...`,
          )
        }
      }
      vaultArg = tx.object(existingVaultId)
    }

    // --- Split USDC coin for deposit ---
    const coins = await suiClient.getCoins({ owner: account.address, coinType: USDC_TYPE })
    if (!coins.data.length) throw new Error('No USDC coins found')

    // Merge all USDC coins then split the margin amount
    const [primaryCoin, ...restCoins] = coins.data.map((c) => c.coinObjectId)
    if (restCoins.length > 0) {
      tx.mergeCoins(tx.object(primaryCoin), restCoins.map((id) => tx.object(id)))
    }
    const [depositCoin] = tx.splitCoins(tx.object(primaryCoin), [marginBase])

    // Deposit into vault
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.VAULT_MODULE}::deposit_entry`,
      typeArguments: [USDC_TYPE],
      arguments: [vaultArg, depositCoin],
    })

    // --- Open position ---
    const pairBytes = new TextEncoder().encode(args.tradingPair)

    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.POSITION_MODULE}::open_position_entry`,
      typeArguments: [USDC_TYPE],
      arguments: [
        vaultArg,
        tx.pure(bcs.vector(bcs.u8()).serialize(pairBytes)),
        tx.pure.u8(args.positionType === 'LONG' ? POSITION_TYPE.LONG : POSITION_TYPE.SHORT),
        tx.pure.u64(Math.floor(args.entryPrice * 1_000_000)),
        tx.pure.u64(Math.floor(args.quantity * 1_000_000)),
        tx.pure.u8(args.leverage),
        tx.pure.u64(marginBase),
        tx.object(CONTRACT_ADDRESSES.SUI_CLOCK_OBJECT_ID),
      ],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  const closePosition = async (positionId: string, closePrice: number) => {
    if (!account) throw new Error('Wallet not connected')

    const vaultId = await findVault(account.address)
    if (!vaultId) throw new Error('No vault found')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.POSITION_MODULE}::close_position_entry`,
      typeArguments: [USDC_TYPE],
      arguments: [
        tx.object(positionId),
        tx.pure.u64(Math.floor(closePrice * 1_000_000)),
        tx.object(vaultId),
        tx.object('0x6'),
      ],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  const addCopyRelation = async (traderAddress: string, copyRatio: number, maxPositionSize: number) => {
    if (!account) throw new Error('Wallet not connected')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.COPY_EXECUTOR_MODULE}::add_copy_relation`,
      arguments: [
        tx.object(CONTRACT_ADDRESSES.COPY_RELATION_REGISTRY_ID),
        tx.pure.address(traderAddress),
        tx.pure.address(account.address),
        tx.pure.u64(copyRatio),
        tx.pure.u64(Math.floor(maxPositionSize * 1_000_000)),
      ],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  const liquidatePosition = async (args: {
    positionId: string
    currentPrice: number
    vaultId: string
  }) => {
    if (!account) throw new Error('Wallet not connected')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.POSITION_MODULE}::liquidate_position_entry`,
      arguments: [
        tx.object(args.positionId),
        tx.pure.u64(Math.floor(args.currentPrice * 1_000_000)),
        tx.object(args.vaultId),
        tx.object(CONTRACT_ADDRESSES.SUI_CLOCK_OBJECT_ID),
      ],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  const updateCopyRelation = async (args: {
    traderAddress: string
    newCopyRatio: number
    newMaxPositionSize: number
  }) => {
    if (!account) throw new Error('Wallet not connected')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.COPY_EXECUTOR_MODULE}::update_copy_relation`,
      arguments: [
        tx.object(CONTRACT_ADDRESSES.COPY_RELATION_REGISTRY_ID),
        tx.pure.address(args.traderAddress),
        tx.pure.u64(args.newCopyRatio),
        tx.pure.u64(Math.floor(args.newMaxPositionSize * 1_000_000)),
      ],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  const deactivateCopyRelation = async (traderAddress: string) => {
    if (!account) throw new Error('Wallet not connected')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.COPY_EXECUTOR_MODULE}::deactivate_copy_relation`,
      arguments: [
        tx.object(CONTRACT_ADDRESSES.COPY_RELATION_REGISTRY_ID),
        tx.pure.address(traderAddress),
      ],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  return {
    openPosition,
    closePosition,
    addCopyRelation,
    liquidatePosition,
    updateCopyRelation,
    deactivateCopyRelation,
    findVault,
  }
}
