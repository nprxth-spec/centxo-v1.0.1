import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://centxo.com';

    return {
        rules: {
            userAgent: '*',
            allow: ['/', '/login', '/signup', '/privacy', '/terms', '/data-deletion', '/policy'],
            disallow: [
                '/api/',
                '/account/',
                '/adbox/',
                '/ads-manager/',
                '/audiences/',
                '/create-ads/',
                '/dashboard/',
                '/export-tools/',
                '/launch/',
                '/payment-activity/',
                '/picker-test/',
                '/report-tools/',
                '/settings/',
                '/tools/',
                '/admin/',
            ],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
