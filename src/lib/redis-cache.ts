import Redis from 'ioredis'

let client: Redis | null = null
let isConnecting = false

export async function getRedisClient() {
    // If already connected, return existing client
    if (client?.status === 'ready') {
        return client
    }

    // If currently connecting, wait a bit and retry
    if (isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100))
        return getRedisClient()
    }

    const redisUrl = process.env.REDIS_URL

    // Allow disabling Redis via env variable
    if (process.env.DISABLE_REDIS === 'true') {
        console.log('⚠️ Redis caching is disabled via DISABLE_REDIS env variable')
        return null
    }

    if (!redisUrl) {
        console.warn('REDIS_URL not configured, caching disabled')
        return null
    }

    try {
        isConnecting = true

        // Close existing client if any
        if (client) {
            try {
                client.disconnect()
            } catch {
                // Ignore disconnect errors
            }
            client = null
        }

        // ioredis automatically handles redis:// and rediss:// URLs
        client = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false,
            retryStrategy(times) {
                if (times > 3) {
                    console.error('Redis connection failed after 3 retries')
                    return null // Stop retrying
                }
                const delay = Math.min(times * 100, 3000)
                return delay
            }
        })

        client.on('error', (err) => {
            console.error('Redis Client Error:', err.message)
        })

        client.on('connect', () => {
            console.log('✅ Redis Client Connected')
        })

        client.on('ready', () => {
            console.log('✅ Redis Client Ready')
        })

        client.on('close', () => {
            console.log('⚠️ Redis Client Disconnected')
        })

        // Wait for connection
        await client.ping()
        isConnecting = false
        return client
    } catch (error) {
        console.error('Failed to connect to Redis:', error instanceof Error ? error.message : error)
        isConnecting = false
        if (client) {
            client.disconnect()
        }
        client = null
        return null
    }
}

export async function getCached<T>(key: string): Promise<T | null> {
    try {
        const redis = await getRedisClient()
        if (!redis || redis.status !== 'ready') return null

        const cached = await redis.get(key)
        if (!cached) return null

        return JSON.parse(cached) as T
    } catch (error) {
        console.error('Cache get error:', error instanceof Error ? error.message : error)
        return null
    }
}

export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
        const redis = await getRedisClient()
        if (!redis || redis.status !== 'ready') return

        await redis.setex(key, ttlSeconds, JSON.stringify(value))
    } catch (error) {
        console.error('Cache set error:', error instanceof Error ? error.message : error)
    }
}

export async function deleteCache(key: string): Promise<void> {
    try {
        const redis = await getRedisClient()
        if (!redis || redis.status !== 'ready') return

        await redis.del(key)
    } catch (error) {
        console.error('Cache delete error:', error instanceof Error ? error.message : error)
    }
}
