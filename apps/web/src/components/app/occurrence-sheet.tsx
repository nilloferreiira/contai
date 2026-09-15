'use client'

import { useEffect, useState } from 'react'
import type { Scope } from '@contai/api'
import type { Frequency } from '@contai/domain'
import { Button } from '@/components/ui/button'
import { CardVisual } from '@/components/app/card-visual'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCards } from '@/hooks/use-cards'
import { useCategories } from '@/hooks/use-categories'
import { useConvertToRecurring, useDeleteOccurrence, useUpdateOccurrence, type OccurrenceRow } from '@/hooks/use-occurrences'
import { useRecurrence, useSetRecurrenceActive, useUpdateRecurrence } from '@/hooks/use-recurrences'

export interface OccurrenceSheetProps {
    occurrence: OccurrenceRow | null
    onOpenChange: (open: boolean) => void
}

const NONE = 'none'

type ExpenseKind = 'single' | 'installment' | 'recurring'

export function OccurrenceSheet({ occurrence, onOpenChange }: OccurrenceSheetProps) {
    return (
        <Dialog open={Boolean(occurrence)} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-md">
                {occurrence && (
                    <OccurrenceEditForm key={occurrence.id} occurrence={occurrence} onOpenChange={onOpenChange} />
                )}
            </DialogContent>
        </Dialog>
    )
}

function OccurrenceEditForm({
    occurrence,
    onOpenChange,
}: {
    occurrence: OccurrenceRow
    onOpenChange: (open: boolean) => void
}) {
    const { data: cards = [] } = useCards()
    const { data: categories = [] } = useCategories()
    const recurrenceQuery = useRecurrence(occurrence.recurrenceId ?? undefined)

    const updateOccurrence = useUpdateOccurrence()
    const deleteOccurrence = useDeleteOccurrence()
    const convertToRecurring = useConvertToRecurring()
    const updateRecurrence = useUpdateRecurrence()
    const setRecurrenceActive = useSetRecurrenceActive()

    const [description, setDescription] = useState(occurrence.description)
    const [amount, setAmount] = useState(String(Number(occurrence.amount)))
    const [categoryId, setCategoryId] = useState(occurrence.categoryId ?? NONE)
    const [cardId, setCardId] = useState(occurrence.cardId ?? NONE)
    const [scope, setScope] = useState<Scope>('occurrence')
    const [kind, setKind] = useState<ExpenseKind>(
        occurrence.recurrenceId ? 'recurring' : occurrence.installmentPlanId ? 'installment' : 'single',
    )
    const [frequency, setFrequency] = useState<Frequency>('monthly')
    const [endDate, setEndDate] = useState('')
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleteScope, setDeleteScope] = useState<Scope>('occurrence')

    const isInstallment = Boolean(occurrence.installmentPlanId)
    const wasRecurring = Boolean(occurrence.recurrenceId)
    const isRecurring = kind === 'recurring'

    useEffect(() => {
        if (!recurrenceQuery.data) return
        setFrequency(recurrenceQuery.data.frequency)
        setEndDate(recurrenceQuery.data.endDate ?? '')
    }, [recurrenceQuery.data])

    const editScopeOptions: { value: Scope; label: string }[] = wasRecurring
        ? [
              { value: 'occurrence', label: 'Apenas esta cobrança' },
              { value: 'future', label: 'Esta e as próximas' },
              { value: 'series', label: 'Toda a assinatura' },
          ]
        : [
              { value: 'occurrence', label: 'Apenas esta parcela' },
              { value: 'series', label: 'Toda a compra' },
          ]

    const deleteScopeOptions: { value: Scope; label: string }[] = wasRecurring
        ? [
              { value: 'occurrence', label: 'Apenas esta cobrança' },
              { value: 'end', label: 'Encerrar assinatura' },
              { value: 'series', label: 'Excluir toda a série' },
          ]
        : [
              { value: 'occurrence', label: 'Apenas esta parcela' },
              { value: 'series', label: 'Todas as parcelas' },
          ]

    function buildCorePatch() {
        const patch: { description?: string; amount?: number; categoryId?: string | null; cardId?: string | null } = {}
        if (description !== occurrence.description) patch.description = description
        const numericAmount = Number(amount)
        if (Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount !== Number(occurrence.amount)) {
            patch.amount = numericAmount
        }
        const nextCategoryId = categoryId === NONE ? null : categoryId
        if (nextCategoryId !== (occurrence.categoryId ?? null)) patch.categoryId = nextCategoryId
        const nextCardId = cardId === NONE ? null : cardId
        if (nextCardId !== (occurrence.cardId ?? null)) patch.cardId = nextCardId
        return patch
    }

    async function handleSave() {
        const convertingToRecurring = !wasRecurring && kind === 'recurring'
        const corePatch = buildCorePatch()

        if (Object.keys(corePatch).length) {
            await updateOccurrence.mutateAsync({
                id: occurrence.id,
                scope: convertingToRecurring ? 'occurrence' : scope,
                data: corePatch,
            })
        }

        if (convertingToRecurring) {
            await convertToRecurring.mutateAsync({ id: occurrence.id, frequency, endDate: endDate || null })
        } else if (wasRecurring && occurrence.recurrenceId && recurrenceQuery.data) {
            const changedFrequency = frequency !== recurrenceQuery.data.frequency
            const changedEnd = (endDate || null) !== (recurrenceQuery.data.endDate ?? null)
            if (changedFrequency || changedEnd) {
                await updateRecurrence.mutateAsync({ id: occurrence.recurrenceId, data: { frequency, endDate: endDate || null } })
            }
        }

        onOpenChange(false)
    }

    return (
        <>
            <DialogHeader>
                <DialogTitle>Editar despesa</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <Label htmlFor="occ-desc">Descrição</Label>
                    <Input id="occ-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>

                <div className="flex flex-col gap-1">
                    <Label htmlFor="occ-amount">
                        {isInstallment && scope !== 'occurrence' ? 'Valor total da compra' : 'Valor'}
                    </Label>
                    <Input
                        id="occ-amount"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                        <Label>Categoria</Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger>
                                <SelectValue />
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
                        <Select value={cardId} onValueChange={setCardId}>
                            <SelectTrigger>
                                <SelectValue />
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
                    <Select value={kind} onValueChange={(value) => setKind(value as ExpenseKind)} disabled={isInstallment}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="single">Única</SelectItem>
                            {isInstallment && <SelectItem value="installment">Parcelada</SelectItem>}
                            <SelectItem value="recurring">Recorrente (assinatura)</SelectItem>
                        </SelectContent>
                    </Select>
                    {isInstallment && (
                        <p className="text-xs text-muted-foreground">Compras parceladas não viram assinatura.</p>
                    )}
                </div>

                {isRecurring && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <Label>Frequência</Label>
                            <Select value={frequency} onValueChange={(value) => setFrequency(value as Frequency)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">Semanal</SelectItem>
                                    <SelectItem value="monthly">Mensal</SelectItem>
                                    <SelectItem value="yearly">Anual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="occ-end">Termina em (opcional)</Label>
                            <Input id="occ-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>
                )}

                {(wasRecurring || isInstallment) && (
                    <div className="rounded-2xl bg-secondary/60 p-3">
                        <p className="mb-2 text-sm font-medium">O que deseja alterar?</p>
                        <RadioGroup value={scope} onValueChange={(value) => setScope(value as Scope)}>
                            {editScopeOptions.map((option) => (
                                <label key={option.value} className="flex items-center gap-2 text-sm">
                                    <RadioGroupItem value={option.value} />
                                    {option.label}
                                </label>
                            ))}
                        </RadioGroup>
                    </div>
                )}

                <Button
                    variant="outline"
                    className="w-full rounded-2xl"
                    onClick={() =>
                        updateOccurrence.mutate(
                            {
                                id: occurrence.id,
                                scope: 'occurrence',
                                data: { status: occurrence.status === 'paid' ? 'pending' : 'paid' },
                            },
                            { onSuccess: () => onOpenChange(false) },
                        )
                    }
                >
                    {occurrence.status === 'paid' ? 'Marcar como pendente' : 'Marcar como paga'}
                </Button>

                {wasRecurring && recurrenceQuery.data && (
                    <Button
                        variant="outline"
                        className="w-full rounded-2xl"
                        disabled={setRecurrenceActive.isPending}
                        onClick={() =>
                            setRecurrenceActive.mutate({
                                id: recurrenceQuery.data.id,
                                active: !recurrenceQuery.data.active,
                            })
                        }
                    >
                        {recurrenceQuery.data.active ? 'Pausar assinatura' : 'Reativar assinatura'}
                    </Button>
                )}

                <Button className="h-12 w-full rounded-2xl" disabled={updateOccurrence.isPending} onClick={handleSave}>
                    Salvar alterações
                </Button>

                {!confirmDelete ? (
                    <Button variant="ghost" className="w-full text-destructive" onClick={() => setConfirmDelete(true)}>
                        Excluir despesa
                    </Button>
                ) : (
                    <div className="rounded-2xl border border-destructive/40 p-3">
                        <p className="mb-2 text-sm font-medium">Confirmar exclusão?</p>
                        {(wasRecurring || isInstallment) && (
                            <RadioGroup
                                value={deleteScope}
                                onValueChange={(value) => setDeleteScope(value as Scope)}
                                className="mb-3"
                            >
                                {deleteScopeOptions.map((option) => (
                                    <label key={option.value} className="flex items-center gap-2 text-sm">
                                        <RadioGroupItem value={option.value} />
                                        {option.label}
                                    </label>
                                ))}
                            </RadioGroup>
                        )}
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
                                Cancelar
                            </Button>
                            <Button
                                variant="destructive"
                                className="flex-1"
                                disabled={deleteOccurrence.isPending}
                                onClick={() =>
                                    deleteOccurrence.mutate(
                                        { id: occurrence.id, scope: deleteScope },
                                        { onSuccess: () => onOpenChange(false) },
                                    )
                                }
                            >
                                Excluir
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
