import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export function useCards() {
    const trpc = useTRPC()
    return useQuery(trpc.cards.list.queryOptions())
}

export function useCreateCard() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.cards.create.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.cards.list.queryKey() })
                toast.success('Cartão criado')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useUpdateCard() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.cards.update.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.cards.list.queryKey() })
                toast.success('Cartão atualizado')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useDeleteCard() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.cards.delete.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.cards.list.queryKey() })
                toast.success('Cartão removido')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
