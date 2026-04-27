/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        // Only apply custom cache headers in production
        if (process.env.NODE_ENV === 'production') {
            return [
                {
                    source: '/_next/static/:path*',
                    headers: [
                        {
                            key: 'Cache-Control',
                            value: 'public, max-age=31536000, immutable',
                        },
                    ],
                },
                {
                    source: '/api/:path*',
                    headers: [
                        {
                            key: 'Cache-Control',
                            value: 'no-cache, no-store, must-revalidate',
                        },
                    ],
                },
            ];
        }

        // In development, return minimal headers for API routes only
        return [
            {
                source: '/api/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-cache, no-store, must-revalidate',
                    },
                ],
            },
        ];
    },
};

export default nextConfig;