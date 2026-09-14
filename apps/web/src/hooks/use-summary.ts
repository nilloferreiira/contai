import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'

export function useSummary(month: string) {
    const trpc = useTRPC()
    return useQuery(trpc.reports.summary.queryOptions({ month }))
}
