import { Skeleton } from '@/components/ui/skeleton'

export interface OccurrenceListSkeletonProps {
    rows?: number
    showDateHeaders?: boolean
}

export function OccurrenceListSkeleton({ rows = 3, showDateHeaders = false }: OccurrenceListSkeletonProps) {
    return (
        <div data-slot="occurrence-list-skeleton" className="flex flex-col gap-1">
            {showDateHeaders && <Skeleton className="mb-1 h-3 w-16" />}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex min-h-11 items-center justify-between rounded-2xl px-3 py-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                </div>
            ))}
        </div>
    )
}
