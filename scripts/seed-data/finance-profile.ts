// scripts/seed-data/finance-profile.ts

export interface SeedCard {
    key: string
    name: string
    closingDay: number
    dueDay: number
    creditLimit: string | null
    color: string
}

export interface SeedCategory {
    key: string
    name: string
    icon: string
}

export interface SeedMerchant {
    key: string
    displayName: string
    normalizedName: string
    categoryKey: string | null
    cardKey: string | null
    usageCount: number
}

export interface SeedExpense {
    key: string
    merchantKey: string
    categoryKey: string
    cardKey: string
    description: string
    totalAmount: string
    purchaseDate: string
    type: 'single' | 'installment'
    installments?: number
}

export interface SeedRecurrence {
    key: string
    merchantKey: string | null
    categoryKey: string | null
    cardKey: string | null
    description: string
    amount: string
    frequency: 'weekly' | 'monthly' | 'yearly'
    startDate: string
    endDate: string | null
}

export const seedCards: SeedCard[] = [
    { key: 'inter', name: 'Inter', closingDay: 5, dueDay: 10, creditLimit: '2000.00', color: 'oklch(0.65 0.21 38)' },
    { key: 'picpay', name: 'Picpay', closingDay: 5, dueDay: 10, creditLimit: '2000.00', color: 'oklch(0.58 0.16 150)' },
    { key: 'nubank', name: 'Nubank', closingDay: 5, dueDay: 10, creditLimit: '1300.00', color: 'oklch(0.5 0.24 300)' },
]

export const seedCategories: SeedCategory[] = [
    { key: 'assinaturas', name: 'Assinaturas', icon: '📺' },
    { key: 'transporte', name: 'Transporte', icon: '🚗' },
    { key: 'mercado', name: 'Mercado', icon: '🛒' },
    { key: 'compras', name: 'Compras', icon: '🛍️' },
    { key: 'casa', name: 'Casa', icon: '🏠' },
    { key: 'alimentacao', name: 'Alimentação', icon: '🍔' },
    { key: 'lazer', name: 'Lazer', icon: '🎮' },
    { key: 'saude', name: 'Saúde', icon: '💊' },
    { key: 'educacao', name: 'Educação', icon: '📚' },
    { key: 'contas', name: 'Contas', icon: '🧾' },
    { key: 'viagem', name: 'Viagem', icon: '✈️' },
    { key: 'outros', name: 'Outros', icon: '📦' },
    { key: 'trabalho', name: 'Trabalho', icon: '💻' },
]

export const seedMerchants: SeedMerchant[] = [
    { key: 'netflix', displayName: 'Netflix', normalizedName: 'netflix', categoryKey: 'assinaturas', cardKey: 'inter', usageCount: 1 },
    { key: 'cadeira', displayName: 'Cadeira', normalizedName: 'cadeira', categoryKey: 'compras', cardKey: 'picpay', usageCount: 2 },
    { key: 'amazon', displayName: 'amazon', normalizedName: 'amazon', categoryKey: 'compras', cardKey: 'inter', usageCount: 2 },
    { key: 'ifood', displayName: 'ifood', normalizedName: 'ifood', categoryKey: 'alimentacao', cardKey: 'inter', usageCount: 3 },
    { key: 'pos-graduacao', displayName: 'Pos Graducao', normalizedName: 'pos graducao', categoryKey: 'educacao', cardKey: 'inter', usageCount: 1 },
    { key: 'anthropic', displayName: 'Anthropic', normalizedName: 'anthropic', categoryKey: 'trabalho', cardKey: 'inter', usageCount: 1 },
    { key: 'spotify', displayName: 'Spotify', normalizedName: 'spotify', categoryKey: 'assinaturas', cardKey: 'inter', usageCount: 1 },
    { key: 'celular', displayName: 'Celular', normalizedName: 'celular', categoryKey: 'outros', cardKey: 'nubank', usageCount: 1 },
    { key: 'mei', displayName: 'Mei', normalizedName: 'mei', categoryKey: 'trabalho', cardKey: null, usageCount: 1 },
    { key: 'youtube-premium', displayName: 'Youtube Premium', normalizedName: 'youtube premium', categoryKey: 'assinaturas', cardKey: 'inter', usageCount: 1 },
    { key: 'google-drive', displayName: 'Google Drive', normalizedName: 'google drive', categoryKey: 'assinaturas', cardKey: 'inter', usageCount: 1 },
    { key: 'linkedin-premium', displayName: 'Linedin Premium', normalizedName: 'linedin premium', categoryKey: 'trabalho', cardKey: 'inter', usageCount: 1 },
    { key: 'shopee', displayName: 'Sla oq Shopee', normalizedName: 'sla oq shopee', categoryKey: 'compras', cardKey: 'picpay', usageCount: 2 },
    { key: 'atalaia-racoes', displayName: 'Atalaia Racoes', normalizedName: 'atalaia racoes', categoryKey: 'compras', cardKey: 'picpay', usageCount: 1 },
    { key: 'presente-pai', displayName: 'Presente Pai', normalizedName: 'presente pai', categoryKey: 'compras', cardKey: 'picpay', usageCount: 2 },
    { key: 'farmacia', displayName: 'Farmácia', normalizedName: 'farmacia', categoryKey: 'saude', cardKey: 'inter', usageCount: 1 },
    { key: 'google-ai-pro', displayName: 'Google ai Pro', normalizedName: 'google ai pro', categoryKey: 'trabalho', cardKey: 'inter', usageCount: 1 },
    { key: 'temakezin', displayName: 'Temakezin', normalizedName: 'temakezin', categoryKey: 'alimentacao', cardKey: 'inter', usageCount: 1 },
    { key: 'petrox-july', displayName: 'Petrox July', normalizedName: 'petrox july', categoryKey: 'outros', cardKey: 'inter', usageCount: 1 },
    { key: 'presente-july-sapatos', displayName: 'Presente July Sapatos', normalizedName: 'presente july sapatos', categoryKey: 'compras', cardKey: 'inter', usageCount: 1 },
    { key: 'hotel-salvador', displayName: 'Hotel Salvador', normalizedName: 'hotel salvador', categoryKey: 'viagem', cardKey: 'inter', usageCount: 1 },
]

export const seedExpenses: SeedExpense[] = [
    { key: 'celular-plano', merchantKey: 'celular', categoryKey: 'outros', cardKey: 'nubank', description: 'Celular', totalAmount: '7956.00', purchaseDate: '2025-04-11', type: 'installment', installments: 24 },
    { key: 'shopee-1', merchantKey: 'shopee', categoryKey: 'compras', cardKey: 'picpay', description: 'Sla oq Shopee', totalAmount: '87.93', purchaseDate: '2026-08-16', type: 'installment', installments: 3 },
    { key: 'atalaia-racoes-1', merchantKey: 'atalaia-racoes', categoryKey: 'compras', cardKey: 'picpay', description: 'Atalaia Racoes', totalAmount: '188.43', purchaseDate: '2026-08-01', type: 'installment', installments: 3 },
    { key: 'presente-pai-1', merchantKey: 'presente-pai', categoryKey: 'compras', cardKey: 'picpay', description: 'Presente Pai', totalAmount: '89.96', purchaseDate: '2026-07-05', type: 'installment', installments: 4 },
    { key: 'presente-pai-2', merchantKey: 'presente-pai', categoryKey: 'compras', cardKey: 'picpay', description: 'Presente Pai', totalAmount: '138.98', purchaseDate: '2026-07-05', type: 'installment', installments: 3 },
    { key: 'cadeira-1', merchantKey: 'cadeira', categoryKey: 'compras', cardKey: 'picpay', description: 'Cadeira', totalAmount: '1279.00', purchaseDate: '2026-05-16', type: 'installment', installments: 10 },
    { key: 'farmacia-1', merchantKey: 'farmacia', categoryKey: 'saude', cardKey: 'inter', description: 'Farmácia', totalAmount: '52.65', purchaseDate: '2026-09-08', type: 'single' },
    { key: 'google-ai-pro-1', merchantKey: 'google-ai-pro', categoryKey: 'trabalho', cardKey: 'inter', description: 'Google ai Pro', totalAmount: '48.49', purchaseDate: '2026-09-11', type: 'single' },
    { key: 'temakezin-1', merchantKey: 'temakezin', categoryKey: 'alimentacao', cardKey: 'inter', description: 'Temakezin', totalAmount: '38.49', purchaseDate: '2026-09-07', type: 'single' },
    { key: 'petrox-july-1', merchantKey: 'petrox-july', categoryKey: 'outros', cardKey: 'inter', description: 'Petrox July', totalAmount: '43.00', purchaseDate: '2026-09-03', type: 'single' },
    { key: 'presente-july-sapatos-1', merchantKey: 'presente-july-sapatos', categoryKey: 'compras', cardKey: 'inter', description: 'Presente July Sapatos', totalAmount: '114.27', purchaseDate: '2026-08-11', type: 'installment', installments: 3 },
    { key: 'hotel-salvador-1', merchantKey: 'hotel-salvador', categoryKey: 'viagem', cardKey: 'inter', description: 'Hotel Salvador', totalAmount: '833.76', purchaseDate: '2026-09-11', type: 'installment', installments: 6 },
]

export const seedRecurrences: SeedRecurrence[] = [
    { key: 'netflix-rec', merchantKey: 'netflix', categoryKey: 'assinaturas', cardKey: 'inter', description: 'Netflix', amount: '45.00', frequency: 'monthly', startDate: '2026-09-09', endDate: null },
    { key: 'pos-graduacao-rec', merchantKey: 'pos-graduacao', categoryKey: 'educacao', cardKey: 'inter', description: 'Pos Graducao', amount: '500.00', frequency: 'monthly', startDate: '2026-01-25', endDate: '2027-01-25' },
    { key: 'anthropic-rec', merchantKey: 'anthropic', categoryKey: 'trabalho', cardKey: 'inter', description: 'Anthropic', amount: '110.00', frequency: 'monthly', startDate: '2026-04-25', endDate: null },
    { key: 'spotify-rec', merchantKey: 'spotify', categoryKey: 'assinaturas', cardKey: 'inter', description: 'Spotify', amount: '31.00', frequency: 'monthly', startDate: '2026-09-11', endDate: null },
    { key: 'mei-rec', merchantKey: 'mei', categoryKey: 'trabalho', cardKey: null, description: 'Mei', amount: '85.00', frequency: 'monthly', startDate: '2026-09-11', endDate: null },
    { key: 'youtube-premium-rec', merchantKey: 'youtube-premium', categoryKey: 'assinaturas', cardKey: 'inter', description: 'Youtube Premium', amount: '34.00', frequency: 'monthly', startDate: '2026-09-11', endDate: null },
    { key: 'google-drive-rec', merchantKey: 'google-drive', categoryKey: 'assinaturas', cardKey: 'inter', description: 'Google Drive', amount: '8.90', frequency: 'monthly', startDate: '2026-09-11', endDate: null },
    { key: 'linkedin-premium-rec', merchantKey: 'linkedin-premium', categoryKey: 'trabalho', cardKey: 'inter', description: 'Linedin Premium', amount: '36.00', frequency: 'monthly', startDate: '2026-09-11', endDate: null },
]
