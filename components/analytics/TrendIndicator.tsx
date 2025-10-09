'use client'

import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'neutral'
  value: string
  className?: string
}

export function TrendIndicator({ trend, value, className }: TrendIndicatorProps) {
  const Icon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus
  
  const variant = trend === 'up' 
    ? 'default' 
    : trend === 'down' 
    ? 'destructive' 
    : 'secondary'

  return (
    <Badge 
      variant={variant} 
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        trend === 'up' && 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200',
        trend === 'down' && 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200',
        trend === 'neutral' && 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200',
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {value}
    </Badge>
  )
}
