"use client"

import { PieChart, Pie, Cell } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"

// Calculate circulating supply
const TOTAL_SUPPLY = 1_000_000_000 // 1 billion
const BURNED = 34_761
const PERMANENTLY_LOCKED = 2_000_000
const TEMPORARILY_LOCKED = 200_000_000
const RAYDIUM_POOL = 100_000_000 // Example value, replace with actual

const CIRCULATING = TOTAL_SUPPLY - BURNED - PERMANENTLY_LOCKED - TEMPORARILY_LOCKED - RAYDIUM_POOL

const data = [
  { name: "Circulating", value: CIRCULATING },
  { name: "Burned", value: BURNED },
  { name: "Permanently Locked", value: PERMANENTLY_LOCKED },
  { name: "Temporarily Locked", value: TEMPORARILY_LOCKED },
  { name: "Raydium Pool", value: RAYDIUM_POOL },
]

const chartConfig = {
  "Circulating": {
    label: "Circulating",
    color: "#10B981", // Emerald-500
  },
  "Burned": {
    label: "Burned",
    color: "#059669", // Emerald-600
  },
  "Permanently Locked": {
    label: "Permanently Locked",
    color: "#047857", // Emerald-700
  },
  "Temporarily Locked": {
    label: "Temporarily Locked",
    color: "#065F46", // Emerald-800
  },
  "Raydium Pool": {
    label: "Raydium Pool",
    color: "#064E3B", // Emerald-900
  },
}

const COLORS = [
  "#10B981", // Emerald-500
  "#059669", // Emerald-600
  "#047857", // Emerald-700
  "#065F46", // Emerald-800
  "#064E3B", // Emerald-900
]

export function CirculatingChart() {
  return (
    <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={100}
          outerRadius={140}
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
        <ChartLegend content={<ChartLegendContent />} />
      </PieChart>
    </ChartContainer>
  )
} 