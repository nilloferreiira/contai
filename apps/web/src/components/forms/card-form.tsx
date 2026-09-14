'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { cardInputSchema, type CardInput } from '@contai/domain'
import { useCreateCard, useUpdateCard } from '@/hooks/use-cards'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CardVisual } from '@/components/app/card-visual'
import { CardColorPicker } from '@/components/app/card-color-picker'
import { DEFAULT_CARD_COLOR } from '@/lib/finance/card-colors'

export interface CardFormProps {
    id?: string
    defaultValues?: Partial<CardInput>
    onSuccess: () => void
}

export function CardForm({ id, defaultValues, onSuccess }: CardFormProps) {
    const createCard = useCreateCard()
    const updateCard = useUpdateCard()

    const {
        register,
        handleSubmit,
        control,
        setValue,
        formState: { errors },
    } = useForm<CardInput>({
        resolver: zodResolver(cardInputSchema),
        defaultValues: {
            name: '',
            closingDay: 1,
            dueDay: 10,
            creditLimit: null,
            color: DEFAULT_CARD_COLOR,
            ...defaultValues,
        },
    })

    const name = useWatch({ control, name: 'name' })
    const color = useWatch({ control, name: 'color' })

    function onSubmit(values: CardInput) {
        if (id) {
            updateCard.mutate({ id, data: values }, { onSuccess })
        } else {
            createCard.mutate(values, { onSuccess })
        }
    }

    return (
        <form data-slot="card-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <CardVisual size="lg" color={color} name={name} />

            <div className="flex flex-col gap-1">
                <label htmlFor="name">Nome</label>
                <Input id="name" {...register('name')} />
                {errors.name && <span className="text-sm text-destructive">{errors.name.message}</span>}
            </div>

            <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1">
                    <label htmlFor="closingDay">Dia de fechamento</label>
                    <Input id="closingDay" type="number" {...register('closingDay', { valueAsNumber: true })} />
                    {errors.closingDay && <span className="text-sm text-destructive">{errors.closingDay.message}</span>}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                    <label htmlFor="dueDay">Dia de vencimento</label>
                    <Input id="dueDay" type="number" {...register('dueDay', { valueAsNumber: true })} />
                    {errors.dueDay && <span className="text-sm text-destructive">{errors.dueDay.message}</span>}
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="creditLimit">Limite (opcional)</label>
                <Input
                    id="creditLimit"
                    type="number"
                    step="0.01"
                    {...register('creditLimit', { setValueAs: (v) => (v === '' ? null : Number(v)) })}
                />
                {errors.creditLimit && <span className="text-sm text-destructive">{errors.creditLimit.message}</span>}
            </div>

            <div className="flex flex-col gap-1">
                <label>Cor</label>
                <CardColorPicker value={color} onChange={(value) => setValue('color', value)} />
            </div>

            <Button type="submit" disabled={createCard.isPending || updateCard.isPending}>
                Salvar
            </Button>
        </form>
    )
}
