"use client"

import { PieChart, Pie, Cell } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"

const data = [
  { name: "Free Market", value: 78 },
  { name: "Marketing", value: 1 },
  { name: "Listings", value: 1 },
  { name: "Team", value: 5 },
  { name: "Renovation/Protocol", value: 15 },
]

const chartConfig = {
  "Free Market": {
    label: "Free Market",
    color: "#10B981", // Emerald-500
  },
  "Marketing": {
    label: "Marketing",
    color: "#3B82F6", // Blue-500
  },
  "Listings": {
    label: "Listings",
    color: "#8B5CF6", // Violet-500
  },
  "Team": {
    label: "Team",
    color: "#F59E0B", // Amber-500
  },
  "Renovation/Protocol": {
    label: "Renovation/Protocol",
    color: "#EC4899", // Pink-500
  },
}

const COLORS = [
  "#10B981", // Emerald-500
  "#3B82F6", // Blue-500
  "#8B5CF6", // Violet-500
  "#F59E0B", // Amber-500
  "#EC4899", // Pink-500
]

export function TokenomicsChart() {
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
                return `${label}: ${value}%`;
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
    </ChartContainer>
  )
} 