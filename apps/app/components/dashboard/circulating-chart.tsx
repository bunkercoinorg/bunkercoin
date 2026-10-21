"use client"

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { LockSummary } from "@/lib/solana"

interface CirculatingChartProps {
  lockData: LockSummary | null
  liquidityData?: number
  burnedData?: number
}

export function CirculatingChart({ lockData, liquidityData = 0, burnedData = 0 }: CirculatingChartProps) {
  // Calculate circulating supply using real lock data
  const TOTAL_SUPPLY = 1_000_000_000 // 1 billion

  // Use real lock data or fallback to 0
  const TOTAL_LOCKED = lockData?.totalLocked || 0
  const CIRCULATING = TOTAL_SUPPLY - burnedData - TOTAL_LOCKED - liquidityData

  const data = [
    { name: "Circulating", value: CIRCULATING },
    { name: "Locked", value: TOTAL_LOCKED },
    { name: "Liquidity", value: liquidityData },
    { name: "Burned", value: burnedData },
  ].filter(item => item.value > 0) // Only show items with positive values

  const chartConfig = {
    "Circulating": {
      label: "Circulating",
      color: "#10B981", // Emerald-500
    },
    "Locked": {
      label: "Locked",
      color: "#3B82F6", // Blue-500
    },
    "Liquidity": {
      label: "Liquidity",
      color: "#8B5CF6", // Violet-500
    },
    "Burned": {
      label: "Burned",
      color: "#F97316", // Orange-500
    },
  }

  const COLORS = [
    "#10B981", // Emerald-500
    "#3B82F6", // Blue-500
    "#8B5CF6", // Violet-500
    "#F97316", // Orange-500
  ]

  return (
    <div className="w-full h-full">
      <ChartContainer config={chartConfig} className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={120}
              paddingAngle={5}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  className="bg-neutral-900 border-neutral-800"
                  formatter={(value: any, name: any, props: any) => {
                    const label = props?.payload?.name || name;
                    return `${label}: ${value.toLocaleString()} BUNKER`;
                  }}
                />
              } 
            />
            <ChartLegend 
              content={
                <ChartLegendContent 
                  className="flex flex-wrap justify-center gap-2 md:gap-4 mt-4 text-xs md:text-sm px-2"
                  nameKey="name"
                />
              } 
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
} 