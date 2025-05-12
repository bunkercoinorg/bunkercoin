"use client"

import { TrendingUpIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { TokenomicsChart } from "@/components/dashboard/tokenomics-chart"
import { CirculatingChart } from "@/components/dashboard/circulating-chart"
import { HoldingsTable } from "@/components/dashboard/holdings-table"
import { PriceChart } from "@/components/dashboard/price-chart"

const TOTAL_SUPPLY = 1_000_000_000 // 1 billion

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 text-white w-full">
      <div className="flex flex-col md:flex-row gap-6 w-full">
        {/* Left: Charts (column on mobile, left on desktop) */}
        <div className="w-full md:w-[500px] shrink-0 flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Tokenomics</h2>
            <TokenomicsChart />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">Circulating Distribution</h2>
            <CirculatingChart />
          </div>
        </div>
        {/* Right: Cards and Table */}
        <div className="flex-1 flex flex-col gap-6 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="relative">
                <CardDescription>Burned</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">
                  <span className="text-emerald-500">34,761 BUNKER</span>
                </CardTitle>
                <div className="absolute right-4 top-4">
                  <Badge variant="outline" className="flex gap-1 rounded-lg text-xs border-neutral-700 text-neutral-400">
                    <TrendingUpIcon className="size-3" />
                    +0.003%
                  </Badge>
                </div>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium text-neutral-400">
                  Burned tokens <TrendingUpIcon className="size-4" />
                </div>
                <div className="text-neutral-500">
                  0.003% of total supply
                </div>
              </CardFooter>
            </Card>
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="relative">
                <CardDescription>Permanently Locked</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">
                  <span className="text-emerald-500">2,000,000 BUNKER</span>
                </CardTitle>
                <div className="absolute right-4 top-4">
                  <Badge variant="outline" className="flex gap-1 rounded-lg text-xs border-neutral-700 text-neutral-400">
                    <TrendingUpIcon className="size-3" />
                    +0.2%
                  </Badge>
                </div>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium text-neutral-400">
                  Permanently locked tokens <TrendingUpIcon className="size-4" />
                </div>
                <div className="text-neutral-500">
                  0.2% of total supply
                </div>
              </CardFooter>
            </Card>
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="relative">
                <CardDescription>Temporarily Locked</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">
                  <span className="text-emerald-500">200,000,000 BUNKER</span>
                </CardTitle>
                <div className="absolute right-4 top-4">
                  <Badge variant="outline" className="flex gap-1 rounded-lg text-xs border-neutral-700 text-neutral-400">
                    <TrendingUpIcon className="size-3" />
                    +20%
                  </Badge>
                </div>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium text-neutral-400">
                  Temporarily locked tokens <TrendingUpIcon className="size-4" />
                </div>
                <div className="text-neutral-500">
                  20% of total supply
                </div>
              </CardFooter>
            </Card>
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader className="relative">
                <CardDescription>Bought Back</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">
                  <span className="text-emerald-500">0 BUNKER</span>
                </CardTitle>
                <div className="absolute right-4 top-4">
                  <Badge variant="outline" className="flex gap-1 rounded-lg text-xs border-neutral-700 text-neutral-400">
                    <TrendingUpIcon className="size-3" />
                    +0%
                  </Badge>
                </div>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium text-neutral-400">
                  No tokens bought back yet <TrendingUpIcon className="size-4" />
                </div>
                <div className="text-neutral-500">
                  Waiting for first buyback
                </div>
              </CardFooter>
            </Card>
          </div>
          <Card className="bg-neutral-900 border-neutral-800 w-full">
            <CardHeader>
              <CardTitle className="text-white">Top Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <HoldingsTable />
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Price Chart - Full width, always at the bottom */}
      <div className="w-full h-[300px] -mx-4 md:-mx-6 -mb-4 md:-mb-6">
        <PriceChart />
      </div>
    </div>
  )
} 