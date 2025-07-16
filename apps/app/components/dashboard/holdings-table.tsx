"use client"

import { useEffect, useState } from "react"
import { getTopHolders, TokenBalance } from "@/lib/solana"
import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Special address tags
const SPECIAL_ADDRESSES: Record<string, string> = {
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1": "Locked Liquidity",
  "E7pwTZzYKcSn8wzTShao9pirj6otP9jky2969ibGV2yc": "Buyback Wallet",
  // Add more special addresses here as needed
}

export function HoldingsTable() {
  const [holders, setHolders] = useState<TokenBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHolders = async () => {
      const data = await getTopHolders(10)
      setHolders(data)
      setLoading(false)
    }

    fetchHolders()
  }, [])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const getTag = (holder: TokenBalance) => {
    // Check for special addresses
    if (SPECIAL_ADDRESSES[holder.address]) {
      return SPECIAL_ADDRESSES[holder.address]
    }
    
    // Check for 14 million holder
    if (holder.balance >= 14_000_000 && holder.balance < 15_000_000) {
      return "Jupiter Token Lock Account"
    }
    
    return null
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-neutral-500">
        Loading top holders...
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-neutral-800">
            <TableHead className="text-neutral-400">#</TableHead>
            <TableHead className="text-neutral-400">Address</TableHead>
            <TableHead className="text-neutral-400 text-right">Balance</TableHead>
            <TableHead className="text-neutral-400 text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holders.map((holder, index) => {
            const tag = getTag(holder)
            return (
              <TableRow key={holder.address} className="border-neutral-800">
                <TableCell className="font-medium text-white">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://solscan.io/account/${holder.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors font-mono text-sm"
                    >
                      {formatAddress(holder.address)}
                      <ExternalLink className="size-3" />
                    </a>
                    {tag && (
                      <Badge variant="outline" className="text-xs border-neutral-700 text-neutral-400">
                        {tag}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-white">
                  {holder.balance.toLocaleString()} BUNKER
                </TableCell>
                <TableCell className="text-right font-bold text-white">
                  {holder.percentage.toFixed(2)}%
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
} 