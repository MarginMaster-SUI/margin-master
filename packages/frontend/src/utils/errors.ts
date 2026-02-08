export function parseOpenPositionError(error: any): { title: string; description: string } {
  const message = error?.message || String(error)

  // User rejection
  if (message.includes('User rejected') || message.includes('rejected the request') || error.code === 4001) {
    return {
      title: 'Transaction Cancelled',
      description: 'You cancelled the transaction. Please approve in your wallet to continue.',
    }
  }

  // Vault creation timeout (indexer lag)
  if (message.includes('Vault creation may still be processing')) {
    return {
      title: 'Transaction Processing',
      description: message, // 保留原本的詳細訊息（含 TX digest）
    }
  }

  // Gas 不足
  if (message.includes('Insufficient') && (message.includes('gas') || message.includes('SUI'))) {
    return {
      title: 'Insufficient Balance',
      description: 'Not enough SUI for gas fees. Please top up your wallet.',
    }
  }

  // USDC 不足
  if (message.includes('No USDC coins found')) {
    return {
      title: 'No USDC Balance',
      description: 'You need USDC to open a position. Please deposit USDC first.',
    }
  }

  // 通用錯誤（保留 fallback）
  return {
    title: 'Failed to Open Position',
    description: message.slice(0, 150) + (message.length > 150 ? '...' : ''),
  }
}
