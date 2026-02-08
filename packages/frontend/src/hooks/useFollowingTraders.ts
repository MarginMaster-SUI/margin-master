import { useQuery } from '@tanstack/react-query'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { api } from '@/services/api'

export function useFollowingTraders() {
  const account = useCurrentAccount()

  const { data: followingAddresses, isLoading } = useQuery({
    queryKey: ['following-traders', account?.address],
    queryFn: async () => {
      if (!account?.address) return new Set<string>()
      const relations = await api.getCopyRelations(account.address)
      return new Set(
        Array.isArray(relations)
          ? relations.filter((r) => r.isActive).map((r) => r.traderAddress)
          : []
      )
    },
    enabled: !!account?.address,
    refetchInterval: 30_000, // 30s auto refresh
  })

  return {
    followingAddresses: followingAddresses ?? new Set<string>(),
    isFollowing: (traderAddress: string) => followingAddresses?.has(traderAddress) ?? false,
    isLoading,
  }
}
