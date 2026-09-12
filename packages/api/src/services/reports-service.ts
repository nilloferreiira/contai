import { and, eq, isNull } from 'drizzle-orm'
import { expenseInstallments } from '@contai/db'
import { summarizeMonth } from '@contai/domain'
import type { Database } from './types'

export async function getMonthSummary(db: Database, userId: string, month: string) {
    const rows = await db
        .select({
            amount: expenseInstallments.amount,
            category_id: expenseInstallments.categoryId,
            card_id: expenseInstallments.cardId,
            status: expenseInstallments.status,
        })
        .from(expenseInstallments)
        .where(and(eq(expenseInstallments.userId, userId), eq(expenseInstallments.invoiceMonth, month), isNull(expenseInstallments.deletedAt)))

    const formattedRows = rows.map((r) => ({
        amount: Number(r.amount),
        category_id: r.category_id,
        card_id: r.card_id,
        status: r.status,
    }))

    return summarizeMonth(formattedRows)
}
