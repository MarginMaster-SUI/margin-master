import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { CONTRACT_ADDRESSES, POSITION_TYPE } from '@/types/sui-contracts'

export function useTradingContract() {
  const account = useCurrentAccount()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()

  const openPosition = async (args: {
    tradingPair: string
    positionType: 'LONG' | 'SHORT'
    entryPrice: number
    quantity: number
    leverage: number
    margin: number
    stopLossPrice?: number
    takeProfitPrice?: number
  }) => {
    if (!account) {
      throw new Error('Wallet not connected')
    }

    const tx = new Transaction()

    // Call open_position function
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.POSITION_MODULE}::open_position`,
      arguments: [
        tx.pure.string(args.tradingPair),
        tx.pure.u8(args.positionType === 'LONG' ? POSITION_TYPE.LONG : POSITION_TYPE.SHORT),
        tx.pure.u64(Math.floor(args.entryPrice * 1_000_000)),
        tx.pure.u64(Math.floor(args.quantity * 1_000_000)),
        tx.pure.u8(args.leverage),
        tx.pure.u64(Math.floor(args.margin * 1_000_000)),
        // Optional stop loss and take profit
        args.stopLossPrice
          ? tx.pure.option('u64', Math.floor(args.stopLossPrice * 1_000_000))
          : tx.pure.option('u64', null),
        args.takeProfitPrice
          ? tx.pure.option('u64', Math.floor(args.takeProfitPrice * 1_000_000))
          : tx.pure.option('u64', null),
      ],
    })

    const result = await signAndExecute({
      transaction: tx as any,
    })

    return result
  }

  const closePosition = async (positionId: string, closePrice: number) => {
    if (!account) {
      throw new Error('Wallet not connected')
    }

    const tx = new Transaction()

    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.POSITION_MODULE}::close_position`,
      arguments: [
        tx.object(positionId),
        tx.pure.u64(Math.floor(closePrice * 1_000_000)),
      ],
    })

    const result = await signAndExecute({
      transaction: tx as any,
    })

    return result
  }

  const enableCopyTrade = async (traderAddress: string, allocationPercentage: number) => {
    if (!account) {
      throw new Error('Wallet not connected')
    }

    const tx = new Transaction()

    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.COPY_EXECUTOR_MODULE}::enable_copy_trade`,
      arguments: [
        tx.pure.address(traderAddress),
        tx.pure.u8(allocationPercentage),
      ],
    })

    const result = await signAndExecute({
      transaction: tx as any,
    })

    return result
  }

  const liquidatePosition = async (args: {
    positionId: string
    currentPrice: number
    vaultId: string
  }) => {
    if (!account) {
      throw new Error('Wallet not connected')
    }

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

    const result = await signAndExecute({
      transaction: tx as any,
    })

    return result
  }

  const updateCopyRelation = async (args: {
    traderAddress: string
    newCopyRatio: number // basis points 1-10000
    newMaxPositionSize: number // USDC
  }) => {
    if (!account) {
      throw new Error('Wallet not connected')
    }

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

    const result = await signAndExecute({
      transaction: tx as any,
    })

    return result
  }

  const deactivateCopyRelation = async (traderAddress: string) => {
    if (!account) {
      throw new Error('Wallet not connected')
    }

    const tx = new Transaction()

    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.COPY_EXECUTOR_MODULE}::deactivate_copy_relation`,
      arguments: [
        tx.object(CONTRACT_ADDRESSES.COPY_RELATION_REGISTRY_ID),
        tx.pure.address(traderAddress),
      ],
    })

    const result = await signAndExecute({
      transaction: tx as any,
    })

    return result
  }

  return {
    openPosition,
    closePosition,
    enableCopyTrade,
    liquidatePosition,
    updateCopyRelation,
    deactivateCopyRelation,
  }
}
