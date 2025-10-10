'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '@/lib/utils'

// Chart configuration type
export type ChartConfigItem = {
  label?: string
  icon?: React.ComponentType
  color?: string
  theme?: {
    light?: string
    dark?: string
  }
}

export interface ChartConfig {
  [key: string]: ChartConfigItem
}

// Context for chart configuration
const ChartContext = React.createContext<ChartConfig | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />')
  }

  return context
}

// Chart Container
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig
    children: React.ReactElement
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={config}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          'flex aspect-video justify-center text-xs',
          className
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = 'ChartContainer'

// Chart Tooltip
const ChartTooltip = RechartsPrimitive.Tooltip

// Chart Tooltip Content
const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<'div'> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: 'line' | 'dot' | 'dashed'
      nameKey?: string
      labelKey?: string
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = 'dot',
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length || !config) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item.dataKey || item.name || 'value'}`
      const itemConfig = (config?.[key as keyof typeof config] || {}) as ChartConfigItem
      const labelConfig = typeof label === 'string' ? ((config?.[label as keyof typeof config] || {}) as ChartConfigItem) : undefined
      const value =
        !labelKey && typeof label === 'string'
          ? labelConfig?.label || label
          : itemConfig?.label

      if (labelFormatter) {
        return (
          <div className={cn('font-medium', labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        )
      }

      if (!value) {
        return null
      }

      return <div className={cn('font-medium', labelClassName)}>{value}</div>
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ])

    if (!active || !payload?.length || !config) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          'grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl',
          className
        )}
      >
        {tooltipLabel}
        <div className="grid gap-1.5">
          {payload.map((item, index: number) => {
            const key = `${nameKey || item.name || item.dataKey || 'value'}`
            const itemConfig = (config?.[key as keyof typeof config] || {}) as ChartConfigItem
            const itemPayload = item.payload as Record<string, unknown> | undefined
            const indicatorColor = color || itemPayload?.fill || item.color

            return (
              <div
                key={String(item.dataKey)}
                className={cn(
                  'flex w-full items-center gap-2 text-xs leading-none',
                  indicator === 'dot' && 'items-center'
                )}
              >
                {!hideIndicator && (
                  <div
                    className={cn(
                      'shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]',
                      {
                        'h-2.5 w-2.5': indicator === 'dot',
                        'w-1': indicator === 'line',
                        'w-0 border-[1.5px] border-dashed bg-transparent':
                          indicator === 'dashed',
                        'my-0.5': (indicator === 'dashed' || indicator === 'line') && label,
                      }
                    )}
                    style={
                      {
                        '--color-bg': indicatorColor,
                        '--color-border': indicatorColor,
                      } as React.CSSProperties
                    }
                  />
                )}
                <div
                  className={cn(
                    'flex flex-1 justify-between leading-none',
                    label && 'items-center'
                  )}
                >
                  <div className="grid gap-1.5">
                    <span className="text-muted-foreground">
                      {itemConfig?.label || String(item.name || '')}
                    </span>
                  </div>
                  {item.value && (
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatter ? formatter(item.value, String(item.name || ''), item, index, payload) : String(item.value)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = 'ChartTooltipContent'

// Chart Legend
const ChartLegend = RechartsPrimitive.Legend

// Chart Legend Content
const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> &
    Pick<RechartsPrimitive.LegendProps, 'payload' | 'verticalAlign'> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(
  (
    { className, hideIcon = false, payload, verticalAlign = 'bottom', nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload?.length || !config) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center gap-4',
          verticalAlign === 'top' ? 'pb-3' : 'pt-3',
          className
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || 'value'}`
          const itemConfig = (config?.[key as keyof typeof config] || {}) as ChartConfigItem

          return (
            <div
              key={item.value}
              className={cn(
                'flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground'
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = 'ChartLegendContent'

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
}
