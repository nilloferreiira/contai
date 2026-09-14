# src/lib/finance

Web-only cosmetic/presentational finance helpers — not business logic (that
lives in `@contai/domain`). `card-colors.ts` defines the fixed OKLCH color
palette used by `CardVisual`/`CardColorPicker`; `resolveCardColor` accepts
either a palette `id` or a raw color string already stored on a card, for
backward compatibility with hand-picked colors.
