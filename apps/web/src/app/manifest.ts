import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Contai',
        short_name: 'Contai',
        description: 'Registre um gasto em segundos, escrevendo do seu jeito.',
        start_url: '/inicio',
        display: 'standalone',
        background_color: 'oklch(0.975 0.008 95)',
        theme_color: 'oklch(0.33 0.06 163)',
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
    }
}
