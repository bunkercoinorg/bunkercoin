"use client"

import { useEffect, useState } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon } from "lucide-react"
import { getPriceData, getPriceHistory, PriceData } from "@/lib/solana"

export function PriceChart() {
  const [priceData, setPriceData] = useState<PriceData | null>(null)
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [currentPrice, history] = await Promise.all([
        getPriceData(),
        getPriceHistory()
      ])
      setPriceData(currentPrice)
      setPriceHistory(history)
      setLoading(false)
    }

    fetchData()
    // Refresh price data every minute
    const interval = setInterval(fetchData, 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  const isPositive = priceData?.priceChange24h ? priceData.priceChange24h > 0 : true

  return (
    <div className="h-full flex flex-col">
      {/* Price Header */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <p className="text-neutral-400 text-sm mb-1">Current Price</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              ${loading ? "..." : priceData?.price.toFixed(6) || "0.000000"}
            </span>
            {!loading && priceData && (
              <span className={`flex items-center text-sm ${isPositive ? 'text-bunker-green' : 'text-red-500'}`}>
                {isPositive ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
                {Math.abs(priceData.priceChange24h).toFixed(2)}%
              </span>
            )}
          </div>
        </div>
        
        <div>
          <p className="text-neutral-400 text-sm mb-1">24h Volume</p>
          <p className="text-xl font-semibold text-white">
            ${loading ? "..." : (priceData?.volume24h || 0).toLocaleString()}
          </p>
        </div>
        
        <div>
          <p className="text-neutral-400 text-sm mb-1">Market Cap</p>
          <p className="text-xl font-semibold text-white">
            ${loading ? "..." : (priceData?.marketCap || 0).toLocaleString()}
          </p>
        </div>
        
        <div>
          <p className="text-neutral-400 text-sm mb-1">FDV</p>
          <p className="text-xl font-semibold text-white">
            ${loading ? "..." : ((priceData?.price || 0) * 1_000_000_000).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={priceHistory} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis 
              dataKey="time" 
              stroke="#71717a"
              fontSize={12}
            />
            <YAxis 
              stroke="#71717a"
              fontSize={12}
              tickFormatter={(value) => `$${value.toFixed(6)}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#18181b', 
                border: '1px solid #27272a',
                borderRadius: '8px' 
              }}
              labelStyle={{ color: '#a1a1aa' }}
              itemStyle={{ color: '#00FFB2' }}
              formatter={(value: any) => [`$${Number(value).toFixed(6)}`, 'Price']}
            />
            <defs>
              <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00FFB2" stopOpacity={0.6} />
                <stop offset="50%" stopColor="#00FFB2" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#00FFB2" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="#00FFB2" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#00FFB2' }}
              fillOpacity={0.4}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
} 