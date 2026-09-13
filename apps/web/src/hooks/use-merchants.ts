import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'

export function useMerchants() {
	const trpc = useTRPC()
	return useQuery(trpc.merchants.list.queryOptions())
}
