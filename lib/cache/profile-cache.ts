// Simple in-memory cache for profile status checks
interface ProfileCacheEntry {
  isActive: boolean
  timestamp: number
}

class ProfileCache {
  private cache = new Map<string, ProfileCacheEntry>()
  private readonly TTL = 5 * 60 * 1000 // 5 minutes

  set(userId: string, isActive: boolean): void {
    this.cache.set(userId, {
      isActive,
      timestamp: Date.now()
    })
  }

  get(userId: string): boolean | null {
    const entry = this.cache.get(userId)
    if (!entry) return null

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(userId)
      return null
    }

    return entry.isActive
  }

  invalidate(userId: string): void {
    this.cache.delete(userId)
  }

  clear(): void {
    this.cache.clear()
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now()
    for (const [userId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(userId)
      }
    }
  }
}

export const profileCache = new ProfileCache()

// Clean up expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    profileCache.cleanup()
  }, 10 * 60 * 1000)
}
