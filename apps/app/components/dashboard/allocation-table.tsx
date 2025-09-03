import { ExternalLink } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { LiquidityPool } from "@/lib/solana"

interface Props {
  liquidityPools: LiquidityPool[]
}

export function AllocationTable({ liquidityPools = [] }: Props) {
  const allocations = [
    {
      name: "Renovation / Protocol Allocation",
      percentage: "15%",
      status: "FULLY LOCKED",
      type: "lock",
      link: "https://lock.jup.ag/token/8NCievmJCg2d9Vc2TWgz2HkE6ANeSX7kwvdq5AL7pump"
    },
    {
      name: "Team Allocation",
      percentage: "5%",
      status: "FULLY LOCKED", 
      type: "lock",
      link: "https://lock.jup.ag/token/8NCievmJCg2d9Vc2TWgz2HkE6ANeSX7kwvdq5AL7pump"
    },
    {
      name: "Marketing Allocation",
      percentage: "1%",
      status: "HELD IN MULTISIG",
      type: "wallet",
      wallet: "2axs98zJ9E9wwc3svvofrJuWiEfPECV7vKvFCNJd2RPU",
      link: "https://solscan.io/account/2axs98zJ9E9wwc3svvofrJuWiEfPECV7vKvFCNJd2RPU"
    },
    {
      name: "Listing Allocation",
      percentage: "1%",
      status: "HELD IN MULTISIG",
      type: "wallet",
      wallet: "63g7GYiTMtd5ephf65WQLThXSRLUpQfTxP4Hd2WnrVGt",
      link: "https://solscan.io/account/63g7GYiTMtd5ephf65WQLThXSRLUpQfTxP4Hd2WnrVGt"
    }
  ]

  const tagClass = (platform: string) =>
    platform === "Raydium"
      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
      : platform === "Meteora"
      ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
      : "bg-neutral-700"

  return (
    <div className="overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block">
      <h4 className="text-sm font-semibold mb-2 md:text-base text-white">Allocation Details</h4>
        <Table>
          <TableHeader>
            <TableRow className="border-neutral-800">
              <TableHead className="text-neutral-400 w-[40%]">Allocation</TableHead>
              <TableHead className="text-neutral-400 w-[10%] text-center">%</TableHead>
              <TableHead className="text-neutral-400 w-[25%]">Status</TableHead>
              <TableHead className="text-neutral-400 w-[25%]">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.map((allocation, index) => (
              <TableRow key={index} className="border-neutral-800">
                <TableCell className="font-medium text-white">{allocation.name}</TableCell>
                <TableCell className="font-bold text-bunker-green text-center">{allocation.percentage}</TableCell>
                <TableCell>
                  <Badge 
                    variant={allocation.status === "FULLY LOCKED" ? "default" : "secondary"}
                    className={allocation.status === "FULLY LOCKED" 
                      ? "bg-bunker-green/20 text-bunker-green border-bunker-green/30" 
                      : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    }
                  >
                    {allocation.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {allocation.type === "lock" ? (
                    <a
                      href={allocation.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      View Lock Details
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <a
                      href={allocation.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors font-mono text-xs"
                    >
                      Wallet: {allocation.wallet?.slice(0, 4)}...{allocation.wallet?.slice(-4)}
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {liquidityPools.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-2 md:text-base text-white">Locked Liquidity Pools</h4>
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-neutral-800">
                  <TableHead className="text-neutral-400">Platform</TableHead>
                  <TableHead className="text-neutral-400">Amount</TableHead>
                  <TableHead className="text-neutral-400 text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="border-neutral-800">
                {liquidityPools.map((pool) => (
                  <TableRow key={pool.address} className="border-neutral-800">
                    <TableCell>
                      <Badge className={tagClass(pool.platform)}>
                        {pool.platform === "Meteora" ? "Meteora DAMM V1" : pool.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-neutral-300">
                      {(pool?.amount ?? 0).toLocaleString()} BUNKER
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`https://solscan.io/account/${pool.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        View on Solscan <ExternalLink className="inline size-4" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Mobile Stacked Layout */}
      <div className="md:hidden space-y-4">
        <h3 className="text-lg font-semibold text-white mb-4">Allocation Details</h3>
        {allocations.map((allocation, index) => (
          <div key={index} className="bg-neutral-800/30 rounded-lg p-4 border border-neutral-700">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-white text-sm">{allocation.name}</h3>
              <span className="font-bold text-bunker-green text-sm">{allocation.percentage}</span>
            </div>
            <div className="flex justify-between items-center">
              <Badge 
                variant={allocation.status === "FULLY LOCKED" ? "default" : "secondary"}
                className={`text-xs ${allocation.status === "FULLY LOCKED" 
                  ? "bg-bunker-green/20 text-bunker-green border-bunker-green/30" 
                  : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                }`}
              >
                {allocation.status === "HELD IN MULTISIG" ? "MULTISIG" : allocation.status}
              </Badge>
              {allocation.type === "lock" ? (
                <a
                  href={allocation.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                >
                  View Lock Details
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <a
                  href={allocation.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors font-mono text-xs"
                >
                  Wallet: {allocation.wallet?.slice(0, 4)}...{allocation.wallet?.slice(-4)}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
        ))}

        {liquidityPools.length > 0 && (
          <>
            <h3 className="text-lg font-semibold text-white mt-8 mb-4">Locked Liquidity Pools</h3>
            {liquidityPools.map((pool) => (
              <div key={pool.address} className="bg-neutral-800/30 rounded-lg p-4 border border-neutral-700">
                <div className="flex justify-between items-start mb-2">
                  <Badge className={`${tagClass(pool.platform)} text-xs`}>
                    {pool.platform}
                  </Badge>
                  <span className="text-sm text-neutral-300 font-medium">
                    {(pool?.amount ?? 0).toLocaleString()} BUNKER
                  </span>
                </div>
                <a
                  href={`https://solscan.io/account/${pool.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                >
                  View on Solscan
                  <ExternalLink className="size-3" />
                </a>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
} 