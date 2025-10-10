/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log context interface
 */
export interface LogContext {
  userId?: string
  requestId?: string
  path?: string
  method?: string
  statusCode?: number
  duration?: number
  error?: Error | unknown
  [key: string]: unknown
}

/**
 * Log entry interface
 */
export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
}

/**
 * Logger options
 */
export interface LoggerOptions {
  prefix?: string
  minLevel?: LogLevel
  enableConsole?: boolean
  enableRemote?: boolean
}
