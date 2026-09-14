import { and, desc, eq, isNull } from 'drizzle-orm'
import { merchants } from '@contai/db'
import type { Database } from './types'

export function listMerchants(db: Database, userId: string) {
    return db
        .select()
        .from(merchants)
        .where(and(eq(merchants.userId, userId), isNull(merchants.deletedAt)))
        .orderBy(desc(merchants.usageCount))
}
