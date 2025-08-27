// Enhanced security utilities for production use
import crypto from 'crypto'

export class SecurityUtils {
  // Generate cryptographically secure random strings
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  // Hash sensitive data with salt
  static hashWithSalt(data: string, salt?: string): { hash: string; salt: string } {
    const finalSalt = salt || crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(data, finalSalt, 100000, 64, 'sha512').toString('hex')
    return { hash, salt: finalSalt }
  }

  // Verify hashed data
  static verifyHash(data: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512').toString('hex')
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'))
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

  // Rate limit key generation
  static generateRateLimitKey(ip: string, userAgent: string, endpoint: string): string {
    const hash = crypto.createHash('sha256')
    hash.update(`${ip}:${userAgent}:${endpoint}`)
    return hash.digest('hex').slice(0, 16)
  }

  // Secure comparison for preventing timing attacks
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  }
}
