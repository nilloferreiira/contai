import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@contai/domain'

export interface SummaryTilesProps {
    total: number
    byCategory: Record<string, number>
    byCard: Record<string, number>
}

export function SummaryTiles({ total, byCategory, byCard }: SummaryTilesProps) {
    const categoryEntries = Object.entries(byCategory)
    const cardEntries = Object.entries(byCard)

    return (
        <div data-slot="summary-tiles" className="grid grid-cols-1 gap-3">
            <Card className="rounded-2xl border-border p-3">
                <CardHeader>
                    <CardTitle>Total do mês</CardTitle>
                </CardHeader>
                <CardContent className="font-display text-2xl font-semibold tabular-nums text-foreground">
                    {formatBRL(total)}
                </CardContent>
            </Card>
            <Card className="rounded-2xl border-border p-3">
                <CardHeader>
                    <CardTitle>Por categoria</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                    {categoryEntries.map(([id, amount]) => (
                        <div key={id} className="flex flex-col gap-1">
                            <div className="flex justify-between">
                                <span className="text-foreground-subtle">{id}</span>
                                <span className="font-display tabular-nums text-foreground">{formatBRL(amount)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-secondary">
                                <div
                                    className="h-2 rounded-full bg-primary"
                                    style={{ width: `${total ? Math.min(100, (amount / total) * 100) : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card className="rounded-2xl border-border p-3">
                <CardHeader>
                    <CardTitle>Por cartão</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                    {cardEntries.map(([id, amount]) => (
                        <div key={id} className="flex justify-between">
                            <span className="text-foreground-subtle">{id}</span>
                            <span className="font-display tabular-nums text-foreground">{formatBRL(amount)}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
