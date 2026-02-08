import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { CONTRACT_ADDRESSES, USDC_TYPE } from '@/types/sui-contracts'

const TRADING_BOT_TYPE = `${CONTRACT_ADDRESSES.PACKAGE_ID}::trading_bot::TradingBot<${USDC_TYPE}>`

export function useTradingBot() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()

  /** Find user's TradingBot objects */
  const findBots = async (owner: string): Promise<Array<{ id: string; data: any }>> => {
    const res = await suiClient.getOwnedObjects({
      owner,
      filter: { StructType: TRADING_BOT_TYPE },
      options: { showContent: true },
    })
    return res.data.map((obj) => ({
      id: obj.data?.objectId ?? '',
      data: (obj.data?.content as any)?.fields ?? {},
    }))
  }

  /** Create a new TradingBot following a trader */
  const createTradingBot = async (args: {
    followedTrader: string
    copyRatio: number // 1-100
    maxPositionSize: number // in USDC display units
    minHoldDuration: number // in seconds
    dailyLossLimit: number // in USDC display units
  }) => {
    if (!account) throw new Error('Wallet not connected')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.TRADING_BOT_MODULE}::create_trading_bot`,
      typeArguments: [USDC_TYPE],
      arguments: [
        tx.object(CONTRACT_ADDRESSES.TRADING_BOT_REGISTRY_ID),
        tx.pure.address(args.followedTrader),
        tx.pure.u64(args.copyRatio * 100), // Convert percentage to basis points
        tx.pure.u64(Math.floor(args.maxPositionSize * 1_000_000)),
        tx.pure.u64(Math.floor(args.dailyLossLimit * 1_000_000)),
        tx.pure.u64(args.minHoldDuration * 1000), // Convert seconds to milliseconds
        tx.object(CONTRACT_ADDRESSES.SUI_CLOCK_OBJECT_ID),
      ],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  /** Deposit USDC into a TradingBot */
  const depositToBot = async (botId: string, amount: number) => {
    if (!account) throw new Error('Wallet not connected')

    const amountBase = Math.floor(amount * 1_000_000)
    const tx = new Transaction()

    // Get USDC coins
    const coins = await suiClient.getCoins({ owner: account.address, coinType: USDC_TYPE })
    if (!coins.data.length) throw new Error('No USDC coins found')

    // Merge and split
    const [primaryCoin, ...restCoins] = coins.data.map((c) => c.coinObjectId)
    if (restCoins.length > 0) {
      tx.mergeCoins(tx.object(primaryCoin), restCoins.map((id) => tx.object(id)))
    }
    const [depositCoin] = tx.splitCoins(tx.object(primaryCoin), [amountBase])

    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.TRADING_BOT_MODULE}::deposit`,
      typeArguments: [USDC_TYPE],
      arguments: [tx.object(botId), depositCoin],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  /** Withdraw USDC from a TradingBot */
  const withdrawFromBot = async (botId: string, amount: number) => {
    if (!account) throw new Error('Wallet not connected')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.TRADING_BOT_MODULE}::withdraw`,
      typeArguments: [USDC_TYPE],
      arguments: [tx.object(botId), tx.pure.u64(Math.floor(amount * 1_000_000))],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  /** Activate a TradingBot to start copying */
  const activateBot = async (botId: string) => {
    if (!account) throw new Error('Wallet not connected')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.TRADING_BOT_MODULE}::activate_bot`,
      typeArguments: [USDC_TYPE],
      arguments: [tx.object(botId), tx.object(CONTRACT_ADDRESSES.TRADING_BOT_REGISTRY_ID)],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  /** Deactivate a TradingBot to pause copying */
  const deactivateBot = async (botId: string) => {
    if (!account) throw new Error('Wallet not connected')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.TRADING_BOT_MODULE}::deactivate_bot`,
      typeArguments: [USDC_TYPE],
      arguments: [tx.object(botId), tx.object(CONTRACT_ADDRESSES.TRADING_BOT_REGISTRY_ID)],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  /** Update bot parameters */
  const updateBotParams = async (args: {
    botId: string
    copyRatio: number
    maxPositionSize: number
    minHoldDuration: number
    dailyLossLimit: number
  }) => {
    if (!account) throw new Error('Wallet not connected')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.TRADING_BOT_MODULE}::update_bot_params`,
      typeArguments: [USDC_TYPE],
      arguments: [
        tx.object(args.botId),
        tx.pure.u64(args.copyRatio),
        tx.pure.u64(Math.floor(args.maxPositionSize * 1_000_000)),
        tx.pure.u64(args.minHoldDuration),
        tx.pure.u64(Math.floor(args.dailyLossLimit * 1_000_000)),
      ],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  /** Destroy an inactive TradingBot (must have zero balance) */
  const destroyBot = async (botId: string) => {
    if (!account) throw new Error('Wallet not connected')

    const tx = new Transaction()
    tx.moveCall({
      target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::${CONTRACT_ADDRESSES.TRADING_BOT_MODULE}::destroy_bot`,
      typeArguments: [USDC_TYPE],
      arguments: [tx.object(botId), tx.object(CONTRACT_ADDRESSES.TRADING_BOT_REGISTRY_ID)],
    })

    return await signAndExecute({ transaction: tx as any })
  }

  return {
    findBots,
    createTradingBot,
    depositToBot,
    withdrawFromBot,
    activateBot,
    deactivateBot,
    updateBotParams,
    destroyBot,
  }
}
