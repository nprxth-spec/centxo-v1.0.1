import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Centxo AI Ad Manager',
        short_name: 'Centxo',
        description: 'Scale your advertising campaigns with AI automation',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1877F2',
        icons: [
            {
                src: '/icon.png',
                sizes: 'any',
                type: 'image/png',
            },
        ],
    }
}
