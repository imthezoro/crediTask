// Robust rate limiting implementation with multiple strategies
interface RateLimitEntry {
  count: number
  resetTime: number
  blocked: boolean
  blockUntil?: number
}

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  blockDurationMs: number
  skipSuccessfulRequests?: boolean
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private readonly configs: Map<string, RateLimitConfig> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Define rate limit configurations for different endpoint types
    this.configs.set('auth', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
      blockDurationMs: 15 * 60 * 1000, // 15 minutes
      skipSuccessfulRequests: true
    })

    this.configs.set('auth-sensitive', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5,
      blockDurationMs: 30 * 60 * 1000, // 30 minutes
      skipSuccessfulRequests: false
    })

    this.configs.set('api', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      blockDurationMs: 5 * 60 * 1000, // 5 minutes
      skipSuccessfulRequests: true
    })

    // Cleanup expired entries every 5 minutes with proper cleanup
    this.startCleanup()
  }

  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
  }

  // Get configuration for a specific type
  public getConfig(configType: string): RateLimitConfig | undefined {
    return this.configs.get(configType)
  }

  private getKey(identifier: string, endpoint: string): string {
    return `${identifier}:${endpoint}`
  }

  private isBlocked(entry: RateLimitEntry): boolean {
    if (!entry.blocked) return false
    
    if (entry.blockUntil && Date.now() > entry.blockUntil) {
      entry.blocked = false
      entry.blockUntil = undefined
      return false
    }
    
    return true
  }

  private resetIfExpired(entry: RateLimitEntry, config: RateLimitConfig): void {
    if (Date.now() > entry.resetTime) {
      entry.count = 0
      entry.resetTime = Date.now() + config.windowMs
    }
  }

  check(identifier: string, endpoint: string, configType: string = 'api'): {
    allowed: boolean
    remaining: number
    resetTime: number
    blocked: boolean
    blockUntil?: number
  } {
    const config = this.configs.get(configType)
    if (!config) {
      throw new Error(`Unknown rate limit config type: ${configType}`)
    }

    const key = this.getKey(identifier, endpoint)
    let entry = this.store.get(key)

    if (!entry) {
      entry = {
        count: 0,
        resetTime: Date.now() + config.windowMs,
        blocked: false
      }
      this.store.set(key, entry)
    }

    // Check if currently blocked
    if (this.isBlocked(entry)) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        blocked: true,
        blockUntil: entry.blockUntil
      }
    }

    // Reset counter if window expired
    this.resetIfExpired(entry, config)

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      // Block the identifier
      entry.blocked = true
      entry.blockUntil = Date.now() + config.blockDurationMs
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        blocked: true,
        blockUntil: entry.blockUntil
      }
    }

    // Increment counter
    entry.count++

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      blocked: false
    }
  }

  // Call this for successful requests if skipSuccessfulRequests is enabled
  recordSuccess(identifier: string, endpoint: string, configType: string = 'api'): void {
    const config = this.configs.get(configType)
    if (!config?.skipSuccessfulRequests) return

    const key = this.getKey(identifier, endpoint)
    const entry = this.store.get(key)
    
    if (entry && entry.count > 0) {
      entry.count--
    }
  }

  // Manual blocking for abuse
  block(identifier: string, endpoint: string, durationMs: number): void {
    const key = this.getKey(identifier, endpoint)
    const entry = this.store.get(key) || {
      count: 0,
      resetTime: Date.now() + 60000,
      blocked: false
    }

    entry.blocked = true
    entry.blockUntil = Date.now() + durationMs
    this.store.set(key, entry)
  }

  // Unblock manually
  unblock(identifier: string, endpoint: string): void {
    const key = this.getKey(identifier, endpoint)
    const entry = this.store.get(key)
    
    if (entry) {
      entry.blocked = false
      entry.blockUntil = undefined
    }
  }

  // Get current status without incrementing
  getStatus(identifier: string, endpoint: string, configType: string = 'api'): {
    count: number
    remaining: number
    blocked: boolean
    blockUntil?: number
  } {
    const config = this.configs.get(configType)
    if (!config) {
      throw new Error(`Unknown rate limit config type: ${configType}`)
    }

    const key = this.getKey(identifier, endpoint)
    const entry = this.store.get(key)

    if (!entry) {
      return {
        count: 0,
        remaining: config.maxRequests,
        blocked: false
      }
    }

    // Check if blocked
    const blocked = this.isBlocked(entry)
    
    // Check if window expired
    const now = Date.now()
    const windowExpired = now > entry.resetTime
    const currentCount = windowExpired ? 0 : entry.count

    return {
      count: currentCount,
      remaining: Math.max(0, config.maxRequests - currentCount),
      blocked,
      blockUntil: entry.blockUntil
    }
  }

  private cleanup(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.store.entries()) {
      // Remove entries that are not blocked and have expired windows
      if (!entry.blocked && now > entry.resetTime + (5 * 60 * 1000)) {
        this.store.delete(key)
      }
      // Remove entries where block has expired
      else if (entry.blocked && entry.blockUntil && now > entry.blockUntil + (60 * 60 * 1000)) {
        this.store.delete(key)
      }
    }
  }

  // Get stats for monitoring
  getStats(): {
    totalEntries: number
    blockedEntries: number
    activeWindows: number
  } {
    const now = Date.now()
    let blockedCount = 0
    let activeWindows = 0

    for (const entry of this.store.values()) {
      if (this.isBlocked(entry)) {
        blockedCount++
      }
      if (now <= entry.resetTime) {
        activeWindows++
      }
    }

    return {
      totalEntries: this.store.size,
      blockedEntries: blockedCount,
      activeWindows
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter()

// Helper function to get client IP
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (cfIP) {
    return cfIP
  }
  
  return 'unknown'
}
