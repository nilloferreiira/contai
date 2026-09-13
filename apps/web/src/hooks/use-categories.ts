import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export function useCategories() {
	const trpc = useTRPC()
	return useQuery(trpc.categories.list.queryOptions())
}

export function useCreateCategory() {
	const trpc = useTRPC()
	const queryClient = useQueryClient()
	return useMutation(
		trpc.categories.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey() })
				toast.success('Categoria criada')
			},
			onError: (error) => toast.error(error.message),
		}),
	)
}

export function useUpdateCategory() {
	const trpc = useTRPC()
	const queryClient = useQueryClient()
	return useMutation(
		trpc.categories.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey() })
				toast.success('Categoria atualizada')
			},
			onError: (error) => toast.error(error.message),
		}),
	)
}

export function useDeleteCategory() {
	const trpc = useTRPC()
	const queryClient = useQueryClient()
	return useMutation(
		trpc.categories.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey() })
				toast.success('Categoria removida')
			},
			onError: (error) => toast.error(error.message),
		}),
	)
}
