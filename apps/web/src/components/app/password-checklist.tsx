import type { ComponentProps } from 'react'
import { Check, X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { passwordRequirements } from '@contai/domain'

export interface PasswordChecklistProps extends ComponentProps<'ul'> {
    password: string
}

export function PasswordChecklist({ password, className, ...props }: PasswordChecklistProps) {
    return (
        <ul
            data-slot="password-checklist"
            className={twMerge('flex flex-col gap-1 text-sm', className)}
            {...props}
        >
            {passwordRequirements.map((req) => {
                const passed = req.test(password)
                return (
                    <li key={req.key} className="flex items-center gap-2" data-passed={passed ? '' : undefined}>
                        {passed ? (
                            <Check className="size-3.5 text-success" aria-hidden="true" />
                        ) : (
                            <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className={passed ? 'text-foreground' : 'text-muted-foreground'}>{req.label}</span>
                    </li>
                )
            })}
        </ul>
    )
}
