'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createExpenseInputSchema, toISODate, type CreateExpenseInput } from '@contai/domain'
import { useCreateExpense } from '@/hooks/use-create-expense'
import { useCards } from '@/hooks/use-cards'
import { useCategories } from '@/hooks/use-categories'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CardVisual } from '@/components/app/card-visual'

export interface ExpenseFormProps {
    onSuccess: () => void
}

export function ExpenseForm({ onSuccess }: ExpenseFormProps) {
    const { data: cards = [] } = useCards()
    const { data: categories = [] } = useCategories()
    const createExpense = useCreateExpense()

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<CreateExpenseInput>({
        resolver: zodResolver(createExpenseInputSchema),
        defaultValues: {
            type: 'single',
            purchaseDate: toISODate(new Date()),
            amount: 0,
            description: '',
        },
    })

    const type = watch('type')

    function onSubmit(values: CreateExpenseInput) {
        createExpense.mutate(values, { onSuccess })
    }

    return (
        <form data-slot="expense-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <label htmlFor="amount">Valor</label>
                <Input id="amount" type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <span className="text-sm text-destructive">{errors.amount.message}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="description">Descrição</label>
                <Input id="description" {...register('description')} />
                {errors.description && <span className="text-sm text-destructive">{errors.description.message}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="type">Tipo</label>
                <Select value={type} onValueChange={(value) => setValue('type', value as CreateExpenseInput['type'])}>
                    <SelectTrigger id="type">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="single">Única</SelectItem>
                        <SelectItem value="installment">Parcelada</SelectItem>
                        <SelectItem value="recurring">Recorrente</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {type === 'installment' && (
                <div className="flex flex-col gap-1">
                    <label htmlFor="installments">Parcelas</label>
                    <Input id="installments" type="number" {...register('installments', { valueAsNumber: true })} />
                    {errors.installments && <span className="text-sm text-destructive">{errors.installments.message}</span>}
                </div>
            )}

            {type === 'recurring' && (
                <div className="flex flex-col gap-1">
                    <label htmlFor="frequency">Frequência</label>
                    <Select
                        value={watch('frequency')}
                        onValueChange={(value) => setValue('frequency', value as CreateExpenseInput['frequency'])}
                    >
                        <SelectTrigger id="frequency">
                            <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.frequency && <span className="text-sm text-destructive">{errors.frequency.message}</span>}
                </div>
            )}

            <div className="flex flex-col gap-1">
                <label htmlFor="categoryId">Categoria</label>
                <Select value={watch('categoryId') ?? undefined} onValueChange={(value) => setValue('categoryId', value)}>
                    <SelectTrigger id="categoryId">
                        <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                        {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                                {category.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="cardId">Cartão</label>
                <Select value={watch('cardId') ?? undefined} onValueChange={(value) => setValue('cardId', value)}>
                    <SelectTrigger id="cardId">
                        <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                        {cards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                                <div className="flex items-center gap-2">
                                    <CardVisual size="sm" color={card.color} name={card.name} />
                                    {card.name}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="purchaseDate">Data</label>
                <Input id="purchaseDate" type="date" {...register('purchaseDate')} />
            </div>

            <Button type="submit" disabled={createExpense.isPending}>
                Salvar
            </Button>
        </form>
    )
}
