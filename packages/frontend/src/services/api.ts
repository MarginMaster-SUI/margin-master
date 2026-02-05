const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error || body.message || JSON.stringify(body);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json();
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  username: string;
  avatarUrl: string | null;
  totalPnL: number;
  winRate: number;
  totalTrades: number;
  followerCount: number;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
}

export interface TraderStats {
  address: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  profile: {
    totalPnL: number;
    winRate: number;
    totalTrades: number;
    followerCount: number;
    sharpeRatio: number | null;
    maxDrawdown: number | null;
  } | null;
  followers: Array<{ address: string; username: string; copyRatio: number }>;
  recentTrades: Array<{
    id: string;
    pair: string;
    side: string;
    tradeType: string;
    price: number;
    quantity: number;
    pnl: number | null;
    executedAt: string;
  }>;
}

export const api = {
  getLeaderboard(sortBy = 'totalPnL'): Promise<LeaderboardEntry[]> {
    return fetchApi(`/api/leaderboard?sortBy=${sortBy}`);
  },

  getTraderStats(address: string): Promise<TraderStats> {
    return fetchApi(`/api/traders/${address}/stats`);
  },

  registerCopyTrade(data: {
    traderAddress: string;
    followerAddress: string;
    copyRatio: number;
    maxPositionSize?: number;
  }): Promise<{ success: boolean; relationId: string }> {
    return fetchApi('/api/copy-trades/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
