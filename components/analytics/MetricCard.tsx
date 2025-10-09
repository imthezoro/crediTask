'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendIndicator } from './TrendIndicator'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    value: string
  }
  icon?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export function MetricCard({
  title,
  value,
  description,
  trend,
  icon,
  className,
  children
}: MetricCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {trend && (
            <TrendIndicator
              trend={trend.direction}
              value={trend.value}
            />
          )}
        </div>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <div className="text-2xl font-bold">{value}</div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
