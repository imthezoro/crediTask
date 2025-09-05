// Enhanced security utilities for production use
export class SecurityUtils {
  // Generate cryptographically secure random strings
  static generateSecureToken(length: number = 32): string {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // Hash sensitive data with salt (simplified for Edge Runtime)
  static async hashWithSalt(data: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const finalSalt = salt || this.generateSecureToken(16)
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data + finalSalt)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hash = Array.from(new Uint8Array(hashBuffer), byte => byte.toString(16).padStart(2, '0')).join('')
    return { hash, salt: finalSalt }
  }

  // Verify hashed data (simplified for Edge Runtime)
  static async verifyHash(data: string, hash: string, salt: string): Promise<boolean> {
    const { hash: verifyHash } = await this.hashWithSalt(data, salt)
    return verifyHash === hash
  }

  // Enhanced input sanitization
  static sanitizeInput(input: string, options: {
    maxLength?: number
    allowHtml?: boolean
    allowSpecialChars?: boolean
  } = {}): string {
    const { maxLength = 1000, allowHtml = false, allowSpecialChars = true } = options
    
    let sanitized = input.trim()
    
    // Remove HTML if not allowed
    if (!allowHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '')
    }
    
    // Remove dangerous characters if special chars not allowed
    if (!allowSpecialChars) {
      sanitized = sanitized.replace(/[<>'"&]/g, '')
    }
    
    // Limit length
    sanitized = sanitized.slice(0, maxLength)
    
    return sanitized
  }

  // Validate and normalize email
  static normalizeEmail(email: string): string {
    return email.toLowerCase().trim().replace(/\s+/g, '')
  }

  // Check for common attack patterns
  static detectSqlInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(--|\/\*|\*\/)/,
      /(\bxp_\w+)/i
    ]
    
    return sqlPatterns.some(pattern => pattern.test(input))
  }

  // Check for XSS patterns
  static detectXss(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi
    ]
    
    return xssPatterns.some(pattern => pattern.test(input))
  }

  // Rate limit key generation (simplified for Edge Runtime)
  static async generateRateLimitKey(ip: string, userAgent: string, endpoint: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(`${ip}:${userAgent}:${endpoint}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hash = Array.from(new Uint8Array(hashBuffer), byte => byte.toString(16).padStart(2, '0')).join('')
    return hash.slice(0, 16)
  }

  // Secure comparison for preventing timing attacks (simplified)
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return result === 0
  }
}
