# src/lib/schemas

Zod schemas for forms and API validation:
- `auth-schema.ts` — sign-in and sign-up schemas, password requirements.

Rules:
- Export both the Zod schemas and their inferred TypeScript types (`z.infer<typeof schema>`).
- Keep validation messages in Portuguese.
- All API routes safeParse incoming payloads with schemas from here before execution.
