"use client"

import { ClockIcon, TrendingUpIcon } from "lucide-react"
import { ExternalLink } from "lucide-react"

export default function BuybacksPage() {
  // Updated data structure to support two transactions per entry
  const buybacks = [
    {
      timestamp: "17.07.2025",
      type: "burn",
      bunkerBought: 203744.614937,
      usdcSpent: 330,
      buybackTx: "8JtYHrjLXo4mMgkVHKZ1ZfKhjH6DAYAsgy14MZn8aijuPVVCLxpVruBapD5xNRoUDJXNahhEzU7fnfH5BFh74ki",
      burnTx: "2XFPuKih9ZoT6rQoLEzxdkDgrdJc8L1smzhXYQPUP5PmArtQzdeFw42AowSbj36bWDgqQf4TiWYj4Z4NK9FPsADN"
    }
  ]

  const summary = {
    totalBunkerBought: buybacks.reduce((sum, b) => sum + b.bunkerBought, 0),
    totalUsdcSpent: buybacks.reduce((sum, b) => sum + b.usdcSpent, 0),
    averagePrice: buybacks.length > 0 
      ? buybacks.reduce((sum, b) => sum + b.usdcSpent, 0) / buybacks.reduce((sum, b) => sum + b.bunkerBought, 0)
      : 0,
    lastBuyback: buybacks.length > 0 ? buybacks[0]?.timestamp || "No buybacks yet" : "No buybacks yet"
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="container mx-auto px-4 md:px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Token Buyback Program</h1>
          <p className="text-neutral-400 mb-4 max-w-5xl">
            The protocol allocates a share of revenue to buy BUNKER on the open market.  Depending on the strategic goal the purchased tokens are either <strong>burned</strong>, <strong>paired and permanently locked</strong> in a liquidity pool, or transferred to the <strong>treasury</strong> for future use.
          </p>

          <a
            href="https://solscan.io/account/E7pwTZzYKcSn8wzTShao9pirj6otP9jky2969ibGV2yc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-bunker-green/10 hover:bg-bunker-green/20 border border-bunker-green/30 rounded-lg text-bunker-green font-medium transition-colors"
          >
            View Buyback Wallet
            <ExternalLink className="size-4" />
          </a>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Buyback Table - Desktop */}
          <div className="flex-1">
            <div className="hidden md:block bg-neutral-900/50 rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Timestamp</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Type</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">BUNKER Bought</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">USDC Spent</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {buybacks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-neutral-500">
                        No buyback transactions yet
                      </td>
                    </tr>
                  ) : (
                    buybacks.map((buyback, index) => (
                      <tr key={index} className="border-b border-neutral-800 last:border-0">
                        <td className="px-6 py-4 text-sm text-white">{buyback.timestamp}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            buyback.type === 'burn' 
                              ? 'bg-orange-500/20 text-orange-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {buyback.type === 'burn' ? 'Buyback and Burn' : 'Buyback and Liquidity Lock'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-white">{buyback.bunkerBought.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-white">${buyback.usdcSpent.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-col gap-2">
                          <a
                              href={`https://solscan.io/tx/${buyback.buybackTx}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                            >
                              <span className="text-neutral-400">Swap:</span>
                              {buyback.buybackTx.slice(0, 8)}...
                              <ExternalLink className="size-3" />
                            </a>
                            {buyback.burnTx && (
                              <a
                                href={`https://solscan.io/tx/${buyback.burnTx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                          >
                                <span className="text-neutral-400">Burn:</span>
                                {buyback.burnTx.slice(0, 8)}...
                            <ExternalLink className="size-3" />
                          </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Layout */}
            <div className="md:hidden space-y-4">
              {buybacks.length === 0 ? (
                <div className="bg-neutral-900/50 rounded-xl border border-neutral-800 p-8 text-center">
                  <p className="text-neutral-500">No buyback transactions yet</p>
                </div>
              ) : (
                buybacks.map((buyback, index) => (
                  <div key={index} className="bg-neutral-900/50 rounded-xl border border-neutral-800 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm text-neutral-400">{buyback.timestamp}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        buyback.type === 'burn' 
                          ? 'bg-orange-500/20 text-orange-400' 
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {buyback.type === 'burn' ? 'Buyback and Burn' : 'Buyback and Lock'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-neutral-400 mb-1">BUNKER Bought</p>
                        <p className="text-sm font-semibold text-white">{buyback.bunkerBought.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-400 mb-1">USDC Spent</p>
                        <p className="text-sm font-semibold text-white">${buyback.usdcSpent.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-3 border-t border-neutral-800">
                      <a
                        href={`https://solscan.io/tx/${buyback.buybackTx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-neutral-400">Swap TX:</span>
                        <span className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                          {buyback.buybackTx.slice(0, 6)}...{buyback.buybackTx.slice(-4)}
                          <ExternalLink className="size-3" />
                        </span>
                      </a>
                      {buyback.burnTx && (
                        <a
                          href={`https://solscan.io/tx/${buyback.burnTx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-neutral-400">Burn TX:</span>
                          <span className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                            {buyback.burnTx.slice(0, 6)}...{buyback.burnTx.slice(-4)}
                            <ExternalLink className="size-3" />
                          </span>
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Summary Card */}
          <div className="w-full lg:w-[320px]">
            <div className="bg-neutral-900/50 rounded-xl border border-neutral-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Buyback Summary</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Total BUNKER Bought:</p>
                  <p className="text-2xl font-bold text-bunker-green">{summary.totalBunkerBought.toLocaleString()}</p>
                </div>
                
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Total USDC Spent:</p>
                  <p className="text-2xl font-bold text-white">${summary.totalUsdcSpent.toLocaleString()}</p>
                </div>
                
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Average Price:</p>
                  <p className="text-2xl font-bold text-white">
                    {summary.averagePrice > 0 ? `$${summary.averagePrice.toFixed(6)}` : '-'}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-neutral-400 mb-1">Last Buyback:</p>
                  <p className="text-lg font-medium text-white flex items-center gap-2">
                    <ClockIcon className="size-4 text-neutral-400" />
                    {summary.lastBuyback}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-neutral-900/30 rounded-xl border border-neutral-800">
              <p className="text-sm text-neutral-400 leading-relaxed">
                Buybacks occur periodically based on the BunkerCoin protocol revenues.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 