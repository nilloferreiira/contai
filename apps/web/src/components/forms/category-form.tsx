'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { categoryInputSchema, type CategoryInput } from '@contai/domain'
import { useCreateCategory, useUpdateCategory } from '@/hooks/use-categories'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface CategoryFormProps {
    id?: string
    defaultValues?: Partial<CategoryInput>
    onSuccess: () => void
}

export function CategoryForm({ id, defaultValues, onSuccess }: CategoryFormProps) {
    const createCategory = useCreateCategory()
    const updateCategory = useUpdateCategory()

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CategoryInput>({
        resolver: zodResolver(categoryInputSchema),
        defaultValues: { name: '', ...defaultValues },
    })

    function onSubmit(values: CategoryInput) {
        if (id) {
            updateCategory.mutate({ id, data: values }, { onSuccess })
        } else {
            createCategory.mutate(values, { onSuccess })
        }
    }

    return (
        <form data-slot="category-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <label htmlFor="name">Nome</label>
                <Input id="name" {...register('name')} />
                {errors.name && <span className="text-sm text-destructive">{errors.name.message}</span>}
            </div>
            <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>
                Salvar
            </Button>
        </form>
    )
}
