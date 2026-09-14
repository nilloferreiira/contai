# src/components/forms

react-hook-form + zod forms. Each form resolves against the same zod schema
its tRPC procedure validates with (imported from `@contai/api`, never
redeclared client-side) so client and server validation can't drift.
