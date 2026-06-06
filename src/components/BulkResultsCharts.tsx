import type { BulkResultItem } from '../types'

interface BulkResultsChartsProps {
    results: BulkResultItem[]
    totalTimeMs: number
}

export default function BulkResultsCharts({ results }: BulkResultsChartsProps) {
    if (results.length === 0) return null

    const times = results.map(r => r.durationMs)
    const sortedTimes = [...times].sort((a, b) => a - b)
    const minTime = sortedTimes[0]
    const maxTime = sortedTimes[sortedTimes.length - 1]

    // Calculate percentiles
    const percentile = (arr: number[], p: number) => {
        const idx = Math.ceil((p / 100) * arr.length) - 1
        return arr[Math.max(0, idx)]
    }

    const p50 = percentile(sortedTimes, 50)
    const p90 = percentile(sortedTimes, 90)
    const p95 = percentile(sortedTimes, 95)
    const p99 = percentile(sortedTimes, 99)

    // Build histogram buckets
    const bucketCount = Math.min(20, Math.max(5, Math.ceil(results.length / 5)))
    const range_ = maxTime - minTime || 1
    const bucketSize = range_ / bucketCount
    const buckets: { from: number; to: number; count: number; successCount: number }[] = []

    for (let i = 0; i < bucketCount; i++) {
        buckets.push({
            from: Math.round(minTime + i * bucketSize),
            to: Math.round(minTime + (i + 1) * bucketSize),
            count: 0,
            successCount: 0,
        })
    }

    for (const r of results) {
        let idx = Math.floor((r.durationMs - minTime) / bucketSize)
        if (idx >= bucketCount) idx = bucketCount - 1
        if (idx < 0) idx = 0
        buckets[idx].count++
        if (r.ok) buckets[idx].successCount++
    }

    const maxBucketCount = Math.max(...buckets.map(b => b.count), 1)

    // Status code groups
    const statusGroups: Record<string, number> = {}
    for (const r of results) {
        if (r.ok) {
            const group = `${Math.floor(r.status / 100)}xx`
            statusGroups[group] = (statusGroups[group] || 0) + 1
        } else {
            statusGroups['Error'] = (statusGroups['Error'] || 0) + 1
        }
    }

    const statusColors: Record<string, string> = {
        '2xx': '#4ade80',
        '3xx': '#60a5fa',
        '4xx': '#fb923c',
        '5xx': '#f87171',
        'Error': '#ef4444',
    }

    return (
        <div className="space-y-6 mb-6">
            {/* Response Time Histogram */}
            <div className="bg-bg-tertiary rounded-lg border border-gray-700 p-4">
                <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Response Time Distribution
                </h3>

                {/* Histogram bars */}
                <div className="flex items-end gap-[2px] h-32">
                    {buckets.map((bucket, idx) => {
                        const height = (bucket.count / maxBucketCount) * 100
                        const failRatio = bucket.count > 0 ? (bucket.count - bucket.successCount) / bucket.count : 0
                        return (
                            <div
                                key={idx}
                                className="flex-1 relative group cursor-pointer"
                                style={{ height: '100%' }}
                            >
                                {/* Bar */}
                                <div
                                    className="absolute bottom-0 left-0 right-0 rounded-t transition-all duration-300"
                                    style={{
                                        height: `${Math.max(height, 2)}%`,
                                        background: failRatio > 0.5
                                            ? `linear-gradient(to top, #ef4444, #f87171)`
                                            : failRatio > 0
                                                ? `linear-gradient(to top, #fb923c, #60a5fa)`
                                                : `linear-gradient(to top, #3b82f6, #60a5fa)`,
                                        opacity: 0.8,
                                    }}
                                />
                                {/* Hover tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 pointer-events-none">
                                    <div className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                                        <div className="text-text-primary font-bold">{bucket.count} req</div>
                                        <div className="text-text-tertiary">{bucket.from}–{bucket.to}ms</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Axis labels */}
                <div className="flex justify-between mt-1 text-[10px] text-text-tertiary">
                    <span>{minTime}ms</span>
                    <span>{Math.round((minTime + maxTime) / 2)}ms</span>
                    <span>{maxTime}ms</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Percentiles */}
                <div className="bg-bg-tertiary rounded-lg border border-gray-700 p-4">
                    <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        Percentiles
                    </h3>
                    <div className="space-y-3">
                        {[
                            { label: 'p50 (median)', value: p50, color: '#4ade80' },
                            { label: 'p90', value: p90, color: '#60a5fa' },
                            { label: 'p95', value: p95, color: '#fb923c' },
                            { label: 'p99', value: p99, color: '#f87171' },
                        ].map(({ label, value, color }) => (
                            <div key={label}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-text-secondary">{label}</span>
                                    <span className="font-mono font-bold" style={{ color }}>{value}ms</span>
                                </div>
                                <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${maxTime > 0 ? (value / maxTime) * 100 : 0}%`,
                                            backgroundColor: color,
                                            opacity: 0.7,
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-bg-tertiary rounded-lg border border-gray-700 p-4">
                    <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                        </svg>
                        Status Distribution
                    </h3>

                    {/* CSS Donut */}
                    <div className="flex items-center gap-6">
                        <div className="relative w-24 h-24 flex-shrink-0">
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                {(() => {
                                    let offset = 0
                                    const entries = Object.entries(statusGroups)
                                    return entries.map(([group, count]) => {
                                        const pct = (count / results.length) * 100
                                        const dashArray = `${pct} ${100 - pct}`
                                        const el = (
                                            <circle
                                                key={group}
                                                cx="18" cy="18" r="15.9155"
                                                fill="none"
                                                stroke={statusColors[group] || '#6b7280'}
                                                strokeWidth="3.5"
                                                strokeDasharray={dashArray}
                                                strokeDashoffset={`${-offset}`}
                                                className="transition-all duration-500"
                                            />
                                        )
                                        offset += pct
                                        return el
                                    })
                                })()}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-bold text-text-primary">{results.length}</span>
                                <span className="text-[9px] text-text-tertiary">total</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="space-y-2 flex-1">
                            {Object.entries(statusGroups).map(([group, count]) => (
                                <div key={group} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-sm"
                                            style={{ backgroundColor: statusColors[group] || '#6b7280' }}
                                        />
                                        <span className="text-xs text-text-secondary">{group}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-text-primary">{count}</span>
                                        <span className="text-[10px] text-text-tertiary">
                                            ({Math.round((count / results.length) * 100)}%)
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline Scatter Plot */}
            <div className="bg-bg-tertiary rounded-lg border border-gray-700 p-4">
                <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Response Timeline
                    <span className="text-[10px] text-text-tertiary font-normal ml-1">
                        (each dot = one request, Y = response time)
                    </span>
                </h3>
                <div className="relative h-28">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="border-b border-gray-700/30 w-full" />
                        ))}
                    </div>

                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-text-tertiary -ml-1 pr-1">
                        <span>{maxTime}ms</span>
                        <span>{Math.round(maxTime / 2)}ms</span>
                        <span>{minTime}ms</span>
                    </div>

                    {/* Dots */}
                    <div className="absolute left-8 right-0 top-0 bottom-0">
                        {results.map((r, idx) => {
                            const x = results.length > 1 ? (idx / (results.length - 1)) * 100 : 50
                            const y = maxTime > minTime
                                ? ((r.durationMs - minTime) / (maxTime - minTime)) * 100
                                : 50
                            return (
                                <div
                                    key={idx}
                                    className="absolute w-[6px] h-[6px] rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-[2.5] cursor-pointer group"
                                    style={{
                                        left: `${x}%`,
                                        bottom: `${y}%`,
                                        backgroundColor: r.ok ? '#60a5fa' : '#ef4444',
                                        opacity: 0.7,
                                    }}
                                >
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                                        <div className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                                            <div className="font-bold text-text-primary">#{r.index + 1}</div>
                                            <div className="text-text-secondary">{r.durationMs}ms — {r.ok ? r.status : 'ERR'}</div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-text-tertiary ml-8">
                    <span>Request #1</span>
                    <span>Request #{results.length}</span>
                </div>
            </div>
        </div>
    )
}
