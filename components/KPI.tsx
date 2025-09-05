interface KPIProps {
  title: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
}

export default function KPI({ title, value, change, trend }: KPIProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600'
      case 'down': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow border">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <div className="flex items-baseline">
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        {change && (
          <p className={`ml-2 text-sm ${getTrendColor()}`}>
            {change}
          </p>
        )}
      </div>
    </div>
  )
}
