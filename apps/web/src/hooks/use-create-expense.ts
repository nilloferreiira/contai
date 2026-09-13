import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export function useCreateExpense() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.expenses.create.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.merchants.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                toast.success('Despesa registrada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
