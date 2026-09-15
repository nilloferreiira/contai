import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export function useRecurrence(id: string | undefined) {
    const trpc = useTRPC()
    return useQuery({ ...trpc.recurrences.get.queryOptions({ id: id ?? '' }), enabled: Boolean(id) })
}

export function useUpdateRecurrence() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.recurrences.update.mutationOptions({
            onSuccess: (_data, variables) => {
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.recurrences.get.queryKey({ id: variables.id }) })
                toast.success('Assinatura atualizada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useSetRecurrenceActive() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.recurrences.setActive.mutationOptions({
            onSuccess: (_data, variables) => {
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.recurrences.get.queryKey({ id: variables.id }) })
                toast.success('Assinatura atualizada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
