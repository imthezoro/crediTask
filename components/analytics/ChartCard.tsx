'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'

interface ChartCardProps {
  title: string
  description?: string
  data: Record<string, unknown>[]
  type: 'line' | 'bar' | 'area'
  xKey: string
  yKey: string
  config?: ChartConfig
  footer?: React.ReactNode
  className?: string
  showGrid?: boolean
  showYAxis?: boolean
}

const defaultConfig: ChartConfig = {
  value: {
    label: 'Value',
    color: 'hsl(var(--primary))',
  },
}

export function ChartCard({
  title,
  description,
  data,
  type,
  xKey,
  yKey,
  config = defaultConfig,
  footer,
  className,
  showGrid = true,
  showYAxis = false,
}: ChartCardProps) {
  const chartConfig = {
    [yKey]: {
      label: config[yKey]?.label || yKey,
      color: config[yKey]?.color || 'hsl(var(--primary))',
    },
  }

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 5, left: -20, bottom: 0 },
    }

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid vertical={false} strokeDasharray="3 3" />}
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            {showYAxis && (
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
            )}
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Line
              dataKey={yKey}
              type="monotone"
              stroke={chartConfig[yKey].color}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        )
      
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid vertical={false} strokeDasharray="3 3" />}
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            {showYAxis && (
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
            )}
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar
              dataKey={yKey}
              fill={chartConfig[yKey].color}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        )
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid vertical={false} strokeDasharray="3 3" />}
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            {showYAxis && (
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
            )}
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Area
              dataKey={yKey}
              type="monotone"
              fill={chartConfig[yKey].color}
              fillOpacity={0.2}
              stroke={chartConfig[yKey].color}
              strokeWidth={2}
            />
          </AreaChart>
        )
    }
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          {renderChart()}
        </ChartContainer>
      </CardContent>
      {footer && <CardFooter className="flex-col items-start gap-2 text-sm">{footer}</CardFooter>}
    </Card>
  )
}
