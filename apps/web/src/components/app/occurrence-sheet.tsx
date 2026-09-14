'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import type { Scope } from '@contai/api'
import { useUpdateOccurrence, useDeleteOccurrence, type OccurrenceRow } from '@/hooks/use-occurrences'

export interface OccurrenceSheetProps {
    occurrence: OccurrenceRow | null
    onOpenChange: (open: boolean) => void
}

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
    { value: 'occurrence', label: 'Só esta' },
    { value: 'future', label: 'Esta e as futuras' },
    { value: 'series', label: 'Toda a série' },
]

export function OccurrenceSheet({ occurrence, onOpenChange }: OccurrenceSheetProps) {
    const updateOccurrence = useUpdateOccurrence()
    const deleteOccurrence = useDeleteOccurrence()

    if (!occurrence) return null

    const applicableScopes = occurrence.installmentPlanId
        ? [SCOPE_OPTIONS[0], SCOPE_OPTIONS[1]]
        : occurrence.recurrenceId
        ? [SCOPE_OPTIONS[0], SCOPE_OPTIONS[2]]
        : [SCOPE_OPTIONS[0]]

    return (
        <Sheet open={Boolean(occurrence)} onOpenChange={onOpenChange}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>{occurrence.description}</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 p-4">
                    <label className="flex items-center justify-between">
                        <span>Pago</span>
                        <Switch
                            checked={occurrence.status === 'paid'}
                            onCheckedChange={(checked) =>
                                updateOccurrence.mutate({
                                    id: occurrence.id,
                                    scope: 'occurrence',
                                    data: { status: checked ? 'paid' : 'pending' },
                                })
                            }
                        />
                    </label>
                    <div className="flex flex-col gap-2">
                        {applicableScopes.map((scope) => (
                            <Button
                                key={scope.value}
                                variant="destructive"
                                onClick={() => {
                                    deleteOccurrence.mutate({ id: occurrence.id, scope: scope.value })
                                    onOpenChange(false)
                                }}
                            >
                                Excluir: {scope.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
