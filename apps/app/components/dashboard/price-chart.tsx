"use client"

import { useEffect, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface PriceData {
  timestamp: number
  price: number
}

const chartConfig = {
  price: {
    label: "Price",
    color: "#10B981", // Emerald-500
  },
}

export function PriceChart() {
  const [data, setData] = useState<PriceData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch 365 days of daily data
        const response = await fetch(
          "https://api.coingecko.com/api/v3/coins/bunkercoin/market_chart?vs_currency=usd&days=365&interval=daily"
        )
        const json = await response.json()
        
        // Transform the data
        const formattedData = json.prices.map(([timestamp, price]: [number, number]) => ({
          timestamp,
          price,
        }))
        
        setData(formattedData)
      } catch (error) {
        console.error("Error fetching price data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="w-[full+50px] h-full flex items-center justify-center text-white">Loading...</div>
  }

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="price"
            stroke="#10B981"
            strokeOpacity={0.5}
            fill="url(#priceGradient)"
            strokeWidth={1.5}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="bg-neutral-900 border-neutral-800"
                formatter={(value: any) => {
                  const numValue = Number(value)
                  return `Price: $${numValue.toFixed(4)}`
                }}
              />
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
} 