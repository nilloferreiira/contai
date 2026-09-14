import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'
import type { OccurrenceFilters } from '@contai/api'

export function useOccurrences(filters: OccurrenceFilters) {
    const trpc = useTRPC()
    return useQuery(trpc.occurrences.list.queryOptions(filters))
}

export function useUpdateOccurrence() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.occurrences.update.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
                toast.success('Ocorrência atualizada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useDeleteOccurrence() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.occurrences.delete.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
                toast.success('Ocorrência removida')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
