'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { createExpenseInputSchema, toISODate, type CreateExpenseInput } from '@contai/domain'
import { useCreateExpense } from '@/hooks/use-create-expense'
import { useCards } from '@/hooks/use-cards'
import { useCategories } from '@/hooks/use-categories'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CardVisual } from '@/components/app/card-visual'

const NONE = 'none'

export interface ExpenseFormProps {
    onSuccess: () => void
    defaultValues?: Partial<CreateExpenseInput>
}

export function ExpenseForm({ onSuccess, defaultValues }: ExpenseFormProps) {
    const { data: cards = [] } = useCards()
    const { data: categories = [] } = useCategories()
    const createExpense = useCreateExpense()

    const {
        register,
        handleSubmit,
        control,
        setValue,
        formState: { errors },
    } = useForm<CreateExpenseInput>({
        resolver: zodResolver(createExpenseInputSchema),
        defaultValues: {
            type: 'single',
            purchaseDate: toISODate(new Date()),
            amount: 0,
            description: '',
            installments: 2,
            frequency: 'monthly',
            ...defaultValues,
        },
    })

    const type = useWatch({ control, name: 'type' })
    const frequency = useWatch({ control, name: 'frequency' })
    const categoryId = useWatch({ control, name: 'categoryId' })
    const cardId = useWatch({ control, name: 'cardId' })

    function onSubmit(values: CreateExpenseInput) {
        createExpense.mutate(values, { onSuccess })
    }

    return (
        <form data-slot="expense-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <Label htmlFor="amount">Valor</Label>
                <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    className="h-12 text-lg"
                    {...register('amount', { valueAsNumber: true })}
                />
                {errors.amount && <span className="text-sm text-destructive">{errors.amount.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                    <Label htmlFor="merchantName">Estabelecimento</Label>
                    <Input id="merchantName" placeholder="iFood" {...register('merchantName')} />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="purchaseDate">Data da compra</Label>
                    <Input id="purchaseDate" type="date" {...register('purchaseDate')} />
                    {errors.purchaseDate && (
                        <span className="text-sm text-destructive">{errors.purchaseDate.message}</span>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" placeholder="Jantar de sexta" {...register('description')} />
                {errors.description && <span className="text-sm text-destructive">{errors.description.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                    <Label>Categoria</Label>
                    <Select
                        value={categoryId ?? NONE}
                        onValueChange={(value) => setValue('categoryId', value === NONE ? null : value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>Sem categoria</SelectItem>
                            {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                    {category.icon} {category.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <Label>Cartão</Label>
                    <Select
                        value={cardId ?? NONE}
                        onValueChange={(value) => setValue('cardId', value === NONE ? null : value)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Cartão" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NONE}>Sem cartão</SelectItem>
                            {cards.map((card) => (
                                <SelectItem key={card.id} value={card.id}>
                                    <span className="flex items-center gap-2">
                                        <CardVisual color={card.color} size="xs" />
                                        {card.name}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <Label>Tipo</Label>
                <div className="grid grid-cols-3 gap-2">
                    {(
                        [
                            ['single', 'Única'],
                            ['installment', 'Parcelada'],
                            ['recurring', 'Recorrente'],
                        ] as const
                    ).map(([value, label]) => (
                        <Button
                            key={value}
                            type="button"
                            variant={type === value ? 'default' : 'outline'}
                            onClick={() => setValue('type', value)}
                        >
                            {label}
                        </Button>
                    ))}
                </div>
            </div>

            {type === 'installment' && (
                <div className="flex flex-col gap-1">
                    <Label htmlFor="installments">Quantidade de parcelas</Label>
                    <Input id="installments" type="number" {...register('installments', { valueAsNumber: true })} />
                    {errors.installments && (
                        <span className="text-sm text-destructive">{errors.installments.message}</span>
                    )}
                </div>
            )}

            {type === 'recurring' && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                        <Label>Frequência</Label>
                        <Select
                            value={frequency}
                            onValueChange={(value) => setValue('frequency', value as CreateExpenseInput['frequency'])}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="weekly">Semanal</SelectItem>
                                <SelectItem value="monthly">Mensal</SelectItem>
                                <SelectItem value="yearly">Anual</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.frequency && (
                            <span className="text-sm text-destructive">{errors.frequency.message}</span>
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="endDate">Termina em (opcional)</Label>
                        <Input id="endDate" type="date" {...register('endDate')} />
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-1">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" {...register('notes')} />
            </div>

            <Button type="submit" className="h-12 rounded-2xl" disabled={createExpense.isPending}>
                {createExpense.isPending ? 'Salvando...' : 'Salvar despesa'}
            </Button>
        </form>
    )
}
