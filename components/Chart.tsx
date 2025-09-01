'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface ChartProps {
  data: Array<Record<string, string | number>>
  type?: 'line' | 'bar'
  xKey: string
  yKey: string
  title?: string
}

export default function Chart({ data, type = 'line', xKey, yKey, title }: ChartProps) {
  const ChartComponent = type === 'line' ? LineChart : BarChart

  return (
    <div className="bg-white p-6 rounded-lg shadow border">
      {title && <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          {type === 'line' ? (
            <Line
              dataKey={yKey}
              stroke="#2563eb"
              strokeWidth={2}
            />
          ) : (
            <Bar
              dataKey={yKey}
              fill="#2563eb"
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}
