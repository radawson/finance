interface PriorityData {
  LOW?: number
  MEDIUM?: number
  HIGH?: number
  CRITICAL?: number
}

interface PriorityPieChartProps {
  data: PriorityData
  size?: number
}

const COLORS = {
  LOW: '#10b981', // green
  MEDIUM: '#3b82f6', // blue
  HIGH: '#eab308', // yellow
  CRITICAL: '#ef4444', // red
}

export default function PriorityPieChart({ data, size = 120 }: PriorityPieChartProps) {
  const total = (data.LOW || 0) + (data.MEDIUM || 0) + (data.HIGH || 0) + (data.CRITICAL || 0)

  if (total === 0) {
    return (
      <div 
        className="flex items-center justify-center rounded-full bg-gray-100 text-gray-400"
        style={{ width: size, height: size }}
      >
        <span className="text-sm">No data</span>
      </div>
    )
  }

  const priorities = [
    { key: 'CRITICAL', value: data.CRITICAL || 0, color: COLORS.CRITICAL },
    { key: 'HIGH', value: data.HIGH || 0, color: COLORS.HIGH },
    { key: 'MEDIUM', value: data.MEDIUM || 0, color: COLORS.MEDIUM },
    { key: 'LOW', value: data.LOW || 0, color: COLORS.LOW },
  ].filter(p => p.value > 0)

  let currentAngle = -90 // Start from top

  const segments = priorities.map((priority) => {
    const percentage = priority.value / total
    const angle = percentage * 360

    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    // Calculate SVG path for pie slice
    const radius = 50
    const center = 50

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = center + radius * Math.cos(startRad)
    const y1 = center + radius * Math.sin(startRad)
    const x2 = center + radius * Math.cos(endRad)
    const y2 = center + radius * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ')

    return {
      path: pathData,
      color: priority.color,
      key: priority.key,
      value: priority.value,
      percentage: Math.round(percentage * 100),
    }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <svg 
        viewBox="0 0 100 100" 
        style={{ width: size, height: size }}
        className="transform hover:scale-105 transition-transform"
      >
        {segments.map((segment, index) => (
          <g key={index}>
            {segment.percentage >= 99 ? (
              // Render as full circle when it's 100% (or very close)
              <circle
                cx="50"
                cy="50"
                r="50"
                fill={segment.color}
                className="hover:opacity-80 transition-opacity cursor-pointer"
              >
                <title>{`${segment.key}: ${segment.value} (${segment.percentage}%)`}</title>
              </circle>
            ) : (
              // Render as arc path for partial segments
              <path
                d={segment.path}
                fill={segment.color}
                className="hover:opacity-80 transition-opacity cursor-pointer"
              >
                <title>{`${segment.key}: ${segment.value} (${segment.percentage}%)`}</title>
              </path>
            )}
          </g>
        ))}
        {/* Center circle for donut effect */}
        <circle cx="50" cy="50" r="30" fill="white" />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-2xl font-bold fill-gray-700"
        >
          {total}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-center text-xs">
        {priorities.map((priority) => (
          <div key={priority.key} className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: priority.color }}
            />
            <span className="text-gray-600">
              {priority.key.charAt(0) + priority.key.slice(1).toLowerCase()}: {priority.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

