import { LogLevel, LogContext, LogEntry, LoggerOptions } from './types'

/**
 * Structured Logger Class
 * Provides context-aware logging with different levels
 */
export class Logger {
  private prefix: string
  private minLevel: LogLevel
  private enableConsole: boolean
  private enableRemote: boolean

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix || 'App'
    this.minLevel = options.minLevel || LogLevel.INFO
    this.enableConsole = options.enableConsole ?? true
    this.enableRemote = options.enableRemote ?? false
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    const currentLevelIndex = levels.indexOf(this.minLevel)
    const logLevelIndex = levels.indexOf(level)
    return logLevelIndex >= currentLevelIndex
  }

  /**
   * Format log entry
   */
  private formatEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    }
  }

  /**
   * Log to console with colors
   */
  private logToConsole(entry: LogEntry): void {
    if (!this.enableConsole) return

    const prefix = `[${this.prefix}]`
    const timestamp = entry.timestamp
    const contextStr = entry.context ? JSON.stringify(entry.context, null, 2) : ''

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`🔍 ${prefix} ${timestamp}`, entry.message, contextStr)
        break
      case LogLevel.INFO:
        console.info(`ℹ️  ${prefix} ${timestamp}`, entry.message, contextStr)
        break
      case LogLevel.WARN:
        console.warn(`⚠️  ${prefix} ${timestamp}`, entry.message, contextStr)
        break
      case LogLevel.ERROR:
        console.error(`❌ ${prefix} ${timestamp}`, entry.message, contextStr)
        if (entry.context?.error instanceof Error) {
          console.error(entry.context.error.stack)
        }
        break
    }
  }

  /**
   * Log to remote service (placeholder for future implementation)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async logToRemote(_entry: LogEntry): Promise<void> {
    if (!this.enableRemote) return

    // TODO: Implement remote logging (e.g., to logging service, database, etc.)
    // Example: await fetch('/api/logs', { method: 'POST', body: JSON.stringify(_entry) })
  }

  /**
   * Core logging method
   */
  private async log(level: LogLevel, message: string, context?: LogContext): Promise<void> {
    if (!this.shouldLog(level)) return

    const entry = this.formatEntry(level, message, context)
    
    this.logToConsole(entry)
    await this.logToRemote(entry)
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): void {
    void this.log(LogLevel.DEBUG, message, context)
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    void this.log(LogLevel.INFO, message, context)
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    void this.log(LogLevel.WARN, message, context)
  }

  /**
   * Error level logging
   */
  error(message: string, context?: LogContext): void {
    void this.log(LogLevel.ERROR, message, context)
  }

  /**
   * Create a child logger with additional prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      prefix: `${this.prefix}:${prefix}`,
      minLevel: this.minLevel,
      enableConsole: this.enableConsole,
      enableRemote: this.enableRemote,
    })
  }
}

/**
 * Create a logger instance
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options)
}

/**
 * Default logger instance
 */
export const logger = createLogger({
  prefix: 'PromptOK',
  minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
})
