"use client"

import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getTopHolders, TokenBalance } from "@/lib/solana"
import { Badge } from "@/components/ui/badge"

const SPECIAL_ADDRESSES: Record<string, string> = {
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1": "Raydium Pool",
}

export function HoldingsTable() {
  const [holdings, setHoldings] = useState<TokenBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        const topHolders = await getTopHolders(10)
        setHoldings(topHolders)
      } catch (error) {
        console.error("Error fetching holdings:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchHoldings()
  }, [])

  if (loading) {
    return <div className="text-neutral-400">Loading holdings...</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-neutral-800">
          <TableHead className="text-neutral-400">Address</TableHead>
          <TableHead className="text-right text-neutral-400">Balance</TableHead>
          <TableHead className="text-right text-neutral-400">Percentage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map((holding) => (
          <TableRow key={holding.address} className="border-neutral-800">
            <TableCell className="font-mono text-white">
              <div className="flex items-center gap-2">
                {`${holding.address.slice(0, 4)}...${holding.address.slice(-4)}`}
                {SPECIAL_ADDRESSES[holding.address] && (
                  <Badge variant="outline" className="text-xs border-neutral-700 text-neutral-400">
                    {SPECIAL_ADDRESSES[holding.address]}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right text-white">
              {holding.balance.toLocaleString()} BUNKER
            </TableCell>
            <TableCell className="text-right text-white">
              {holding.percentage.toFixed(2)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
} 