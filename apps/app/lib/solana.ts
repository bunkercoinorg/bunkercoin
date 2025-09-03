import { Connection, PublicKey } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { Buffer } from "buffer"
import { SolanaFMParser, ParserType, checkIfAccountParser } from "@solanafm/explorer-kit"
import { getProgramIdl } from "@solanafm/explorer-kit-idls"
import { getCloudflareContext } from "@opennextjs/cloudflare";

let connection: Connection | undefined;

function getConnection(): Connection {
  if (connection) return connection;

  // Browser: use public RPC (client won’t hit these heavy endpoints)
  if (typeof window !== "undefined") {
    connection = new Connection("https://solana-rpc.publicnode.com", "confirmed");
    return connection;
  }

  // Worker: prefer RPC_URL secret if provided
  let rpc = "https://solana-rpc.publicnode.com";
  try {
    const { env } = getCloudflareContext();
    if (env && (env as any).RPC_URL) {
      rpc = (env as any).RPC_URL as string;
    }
    rpcUrlResolved = rpc;
  } catch {
    // not in worker context during static build
  }
  connection = new Connection(rpc, "confirmed");
  return connection;
}

let rpcUrlResolved = "https://solana-rpc.publicnode.com";

function getRpcUrl(): string {
  // Ensure connection initialized so env is considered
  if (!connection) {
    getConnection();
  }
  return rpcUrlResolved;
}

// BUNKER token mint address
const BUNKER_MINT = new PublicKey("8NCievmJCg2d9Vc2TWgz2HkE6ANeSX7kwvdq5AL7pump")

// Lock program address
const LOCK_PROGRAM_ID = new PublicKey("LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn")

// Constants
const TOTAL_SUPPLY = 1_000_000_000 // 1 billion BUNKER
const DECIMALS = 6 // BUNKER has 6 decimals

export interface TokenBalance {
  address: string
  balance: number
  percentage: number
}

export interface LockAccount {
  pubkey: string
  amount: number  // current locked (unclaimed)
  totalLocked: number  // original total locked
  withdrawn: number
  name: string
  category: 'team' | 'renovation' | 'protocol' | 'other'
  unlockDate?: Date
}

export interface LockSummary {
  totalLocked: number
  teamLocked: number
  renovationLocked: number
  protocolLocked: number
  otherLocked: number
  accounts: LockAccount[]
}

export interface PriceData {
  price: number
  priceChange24h: number
  volume24h: number
  marketCap: number
  high24h: number
  low24h: number
}

export async function getTokenBalance(walletAddress: string): Promise<number> {
  try {
    const tokenAccounts = await getConnection().getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: BUNKER_MINT }
    )

    let totalBalance = 0
    for (const account of tokenAccounts.value) {
      const balance = Number(account.account.data.parsed.info.tokenAmount.amount)
      totalBalance += balance
    }

    return totalBalance
  } catch (error) {
    console.error("Error fetching token balance:", error)
    return 0
  }
}

export async function getTopHolders(limit: number = 10): Promise<TokenBalance[]> {
  try {
    // Get all token accounts for BUNKER
    const tokenAccounts = await getConnection().getProgramAccounts(TOKEN_PROGRAM_ID, {
      filters: [
        {
          dataSize: 165, // size of account (bytes)
        },
        {
          memcmp: {
            offset: 0, // location of our query in the account (bytes)
            bytes: BUNKER_MINT.toBase58(), // our search criteria, a base58 encoded string
          },
        },
      ],
    })

    // Process and sort balances
    const balances: TokenBalance[] = tokenAccounts.map((account) => {
      // The data is already in the correct format, no need to parse base64
      const data = account.account.data
      // The balance is stored at offset 64 and is 8 bytes
      const balance = Number(data.readBigUInt64LE(64)) / Math.pow(10, DECIMALS) // Convert from raw amount to BUNKER
      // The owner is stored at offset 32 and is 32 bytes
      const owner = new PublicKey(data.slice(32, 64)).toBase58()

      return {
        address: owner,
        balance,
        percentage: 0, // Will be calculated after getting total supply
      }
    })

    // Filter out zero balances and sort by balance
    const nonZeroBalances = balances
      .filter((b) => b.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit)

    // Calculate percentages based on total supply
    return nonZeroBalances.map((balance) => ({
      ...balance,
      percentage: (balance.balance / TOTAL_SUPPLY) * 100,
    }))
  } catch (error) {
    console.error("Error fetching top holders:", error)
    return []
  }
}

export async function getTotalSupply(): Promise<number> {
  try {
    const tokenAccounts = await getConnection().getProgramAccounts(TOKEN_PROGRAM_ID, {
      filters: [
        {
          dataSize: 165,
        },
        {
          memcmp: {
            offset: 0,
            bytes: BUNKER_MINT.toBase58(),
          },
        },
      ],
    })

    let totalSupply = 0
    for (const account of tokenAccounts) {
      const parsedInfo = (account.account.data as any).parsed.info
      const balance = Number(parsedInfo.tokenAmount.amount)
      totalSupply += balance
    }

    return totalSupply
  } catch (error) {
    console.error("Error fetching total supply:", error)
    return 0
  }
}

export async function getLockData(): Promise<LockSummary> {
  // Client browser: hit cached API route
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/locks");
      if (res.ok) return await res.json();
    } catch {}
  }
  try {
    // Get SolanaFM IDL for Jupiter Locker
    const SFMIdlItem = await getProgramIdl(LOCK_PROGRAM_ID.toBase58())
    if (!SFMIdlItem) {
      console.error("Could not get Jupiter Locker IDL from SolanaFM")
      return {
        totalLocked: 0,
        teamLocked: 0,
        renovationLocked: 0,
        protocolLocked: 0,
        otherLocked: 0,
        accounts: []
      }
    }

    // Step 1: Get all VestingEscrow accounts (lock data)
    const response = await fetch(getRpcUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: "getProgramAccounts",
        jsonrpc: "2.0",
        params: [
          LOCK_PROGRAM_ID.toBase58(),
          {
            encoding: "base64",
            commitment: "confirmed",
            filters: [
              {
                memcmp: {
                  offset: 0,
                  bytes: "hteFiUjrzUz",
                  encoding: "base58"
                }
              },
              {
                memcmp: {
                  bytes: BUNKER_MINT.toBase58(),
                  offset: 40,
                  encoding: "base58"
                }
              }
            ]
          }
        ],
        id: Date.now().toString()
      })
    })

    const lockAccountsResult = await response.json()
    
    if (!lockAccountsResult.result || lockAccountsResult.result.length === 0) {
      return {
        totalLocked: 0,
        teamLocked: 0,
        renovationLocked: 0,
        protocolLocked: 0,
        otherLocked: 0,
        accounts: []
      }
    }

    // Extract pubkeys from the first call
    const lockAccountData = lockAccountsResult.result
    
    // Step 2: Get detailed metadata for each lock account
    const pubkeys = lockAccountData.map((account: any) => account.pubkey)
    const metadataResponse = await fetch(getRpcUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: "getMultipleAccounts",
        jsonrpc: "2.0",
        params: [
          pubkeys,
          {
            encoding: "base64",
            commitment: "confirmed"
          }
        ],
        id: Date.now().toString()
      })
    })

    const metadataResult = await metadataResponse.json()

    // Step 3: Parse lock accounts using SolanaFM
    const lockAccounts: LockAccount[] = []
    const parser = new SolanaFMParser(SFMIdlItem, LOCK_PROGRAM_ID.toBase58())
    const accountParser = parser.createParser(ParserType.ACCOUNT)

    if (!accountParser || !checkIfAccountParser(accountParser)) {
      console.error("Failed to create SolanaFM account parser")
      return {
        totalLocked: 0,
        teamLocked: 0,
        renovationLocked: 0,
        protocolLocked: 0,
        otherLocked: 0,
        accounts: []
      }
    }
    
    if (metadataResult.result && metadataResult.result.value) {
      lockAccountData.forEach((lockAccount: any, index: number) => {
        const metadataAccount = metadataResult.result.value[index]
        
        if (lockAccount && metadataAccount && metadataAccount.data) {
          try {
            // Decode VestingEscrow account using SolanaFM
            const escrowDecoded = accountParser.parseAccount(lockAccount.account.data[0])
            if (!escrowDecoded || escrowDecoded.name !== 'VestingEscrow') {
              console.warn(`Skipping non-VestingEscrow account ${pubkeys[index]}`)
              return
            }

            const escrowData = escrowDecoded.data
            
            // Log raw decoded data for debugging
            console.log(`\n=== VestingEscrow Account ${index + 1} (${pubkeys[index]}) ===`)
            console.log('Raw escrow data:', JSON.stringify(escrowData, null, 2))
            
            // Calculate amounts (convert from raw to BUNKER with 6 decimals)
            const cliffUnlockAmount = Number(escrowData.cliffUnlockAmount) / Math.pow(10, DECIMALS)
            const amountPerPeriod = Number(escrowData.amountPerPeriod) / Math.pow(10, DECIMALS)
            const numberOfPeriods = Number(escrowData.numberOfPeriod)
            const totalClaimed = Number(escrowData.totalClaimedAmount) / Math.pow(10, DECIMALS)
            const totalLocked = cliffUnlockAmount + (amountPerPeriod * numberOfPeriods)
            const currentLocked = totalLocked - totalClaimed

            // Log calculation breakdown
            console.log('Calculation breakdown:')
            console.log(`  cliffUnlockAmount (raw): ${escrowData.cliffUnlockAmount}`)
            console.log(`  cliffUnlockAmount (BUNKER): ${cliffUnlockAmount.toLocaleString()}`)
            console.log(`  amountPerPeriod (raw): ${escrowData.amountPerPeriod}`)
            console.log(`  amountPerPeriod (BUNKER): ${amountPerPeriod.toLocaleString()}`)
            console.log(`  numberOfPeriods: ${numberOfPeriods}`)
            console.log(`  totalClaimed (raw): ${escrowData.totalClaimedAmount}`)
            console.log(`  totalClaimed (BUNKER): ${totalClaimed.toLocaleString()}`)
            console.log(`  totalLocked = ${cliffUnlockAmount.toLocaleString()} + (${amountPerPeriod.toLocaleString()} * ${numberOfPeriods}) = ${totalLocked.toLocaleString()}`)
            console.log(`  currentLocked = ${totalLocked.toLocaleString()} - ${totalClaimed.toLocaleString()} = ${currentLocked.toLocaleString()}`)

            // Parse unlock date
            let unlockDate: Date | undefined = undefined
            const vestingStartTime = Number(escrowData.vestingStartTime)
            if (vestingStartTime > 1_600_000_000 && vestingStartTime < 2_000_000_000) {
              unlockDate = new Date(vestingStartTime * 1000)
            }

            // Sanity checks
            if (totalLocked <= 0 || totalLocked > TOTAL_SUPPLY) {
              console.log(`  ❌ SKIPPING: totalLocked=${totalLocked.toLocaleString()} (out of range)`)
              return // skip nonsense account
            }

            // Decode VestingEscrowMetadata account using SolanaFM
            let name = "Unknown Lock"
            let category: 'team' | 'renovation' | 'protocol' | 'other' = 'other'
            
            try {
              const metadataDecoded = accountParser.parseAccount(metadataAccount.data[0])
              if (metadataDecoded && metadataDecoded.name === 'VestingEscrowMetadata') {
                name = metadataDecoded.data.name || "Unknown Lock"
                console.log(`  Lock name: "${name}"`)
              }
            } catch (e) {
              console.warn(`Could not decode metadata for ${pubkeys[index]}`)
            }

            // Categorize based on name
            const nameLower = name.toLowerCase()
            if (nameLower.includes('team')) {
              category = 'team'
            } else if (nameLower.includes('renovation')) {
              category = 'renovation'
            } else if (nameLower.includes('protocol')) {
              category = 'protocol'
            }

            console.log(`  Category: ${category}`)
            console.log(`  ✅ ADDING to summary: currentLocked=${currentLocked.toLocaleString()}`)

            // Only add accounts with valid total locked amounts
            if (totalLocked > 0) {
              lockAccounts.push({
                pubkey: pubkeys[index],
                amount: currentLocked, // Current locked = total - claimed
                totalLocked,          // Original total locked
                withdrawn: totalClaimed,
                name,
                category,
                unlockDate
              })
            }
          } catch (error) {
            console.error(`Error parsing lock account ${pubkeys[index]}:`, error)
          }
        }
      })
    }

    // Calculate summary using current locked amounts (after withdrawals)
    const summary: LockSummary = {
      totalLocked: lockAccounts.reduce((sum, acc) => sum + acc.amount, 0), // current still locked
      teamLocked: lockAccounts.filter(acc => acc.category === 'team').reduce((sum, acc) => sum + acc.amount, 0),
      renovationLocked: lockAccounts.filter(acc => acc.category === 'renovation').reduce((sum, acc) => sum + acc.amount, 0),
      protocolLocked: lockAccounts.filter(acc => acc.category === 'protocol').reduce((sum, acc) => sum + acc.amount, 0),
      otherLocked: lockAccounts.filter(acc => acc.category === 'other').reduce((sum, acc) => sum + acc.amount, 0),
      accounts: lockAccounts
    }
    
    console.log(`\n=== LOCK SUMMARY (SolanaFM) ===`)
    console.log(`Parsed ${lockAccounts.length} lock accounts`)
    console.log(`Total current locked: ${summary.totalLocked.toLocaleString()}`)
    console.log(`Sample accounts:`)
    lockAccounts.slice(0, 3).forEach((acc, i) => {
      console.log(`  ${i + 1}. ${acc.name}: Total=${acc.totalLocked.toLocaleString()}, Claimed=${acc.withdrawn.toLocaleString()}, Current=${acc.amount.toLocaleString()}`)
    })

    return summary

  } catch (error) {
    console.error("Error fetching lock data:", error)
    return {
      totalLocked: 0,
      teamLocked: 0,
      renovationLocked: 0,
      protocolLocked: 0,
      otherLocked: 0,
      accounts: []
    }
  }
}

export async function getBurnedTokenData(): Promise<number> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/burned");
      if (res.ok) return await res.json();
    } catch {}
  }
  try {
    const ORIGINAL_TOTAL_SUPPLY = 1_000_000_000 // 1 billion BUNKER
    
    // Get current mint info
    const mintInfo = await getConnection().getParsedAccountInfo(BUNKER_MINT)
    
    if (mintInfo.value?.data && typeof mintInfo.value.data === 'object' && 'parsed' in mintInfo.value.data) {
      const parsed = mintInfo.value.data.parsed
      
      if (parsed.info) {
        const currentSupply = Number(parsed.info.supply) / Math.pow(10, DECIMALS)
        const burnedAmount = ORIGINAL_TOTAL_SUPPLY - currentSupply
        
        return Math.max(0, burnedAmount) // Ensure we don't return negative
      }
    }
    
    return 0
  } catch (error) {
    console.error("Error fetching burned token data:", error)
    return 0
  }
}

export async function getPriceData(): Promise<PriceData | null> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/price");
      if (res.ok) return await res.json();
    } catch {}
  }
  try {
    // Using CoinGecko API with BunkerCoin ID
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bunkercoin&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true'
    )
    
    if (!response.ok) {
      console.error("Failed to fetch price data")
      return null
    }

    const data = await response.json()
    
    // Get BunkerCoin data
    const tokenData = data.bunkercoin

    if (!tokenData) {
      console.error("No BunkerCoin data found")
      return null
    }

    return {
      price: tokenData.usd || 0,
      priceChange24h: tokenData.usd_24h_change || 0,
      volume24h: tokenData.usd_24h_vol || 0,
      marketCap: tokenData.usd_market_cap || 0,
      high24h: 0, // Would need different endpoint for this
      low24h: 0,  // Would need different endpoint for this
    }
  } catch (error) {
    console.error("Error fetching price data:", error)
    return null
  }
}

export async function getPriceHistory(): Promise<{ time: string; price: number }[]> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/history");
      if (res.ok) return await res.json();
    } catch {}
  }
  try {
    // Get 30 days of price data from CoinGecko
    const endpoint =
      'https://api.coingecko.com/api/v3/coins/bunkercoin/market_chart?vs_currency=usd&days=30&interval=daily'

    let response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'cf-worker',
        Accept: 'application/json',
      },
    })

    // If blocked (rate-limited) retry once w/out interval param
    if (response.status === 429 || response.status === 403) {
      response = await fetch(
        'https://api.coingecko.com/api/v3/coins/bunkercoin/market_chart?vs_currency=usd&days=30',
        {
          headers: {
            'User-Agent': 'cf-worker',
            Accept: 'application/json',
          },
        }
      )
    }
    
    if (!response.ok) {
      console.error("Failed to fetch price history")
      return []
    }

    const data = await response.json()
    
    if (!data.prices) {
      return []
    }

    // Transform the data to our format
    return data.prices.map(([timestamp, price]: [number, number]) => {
      const date = new Date(timestamp)
      const month = date.toLocaleDateString('en-US', { month: 'short' })
      const day = date.getDate()
      return {
        time: `${month} ${day}`,
        price: price
      }
    })
  } catch (error) {
    console.error("Error fetching price history:", error)
    return []
  }
}

export interface LiquidityPool {
  platform: "Raydium" | "Meteora" | string;
  address: string;
  amount: number; // in BUNKER units
}

export interface LiquidityInfo {
  total: number;
  pools: LiquidityPool[];
}

export async function getLiquidityPoolData(): Promise<LiquidityInfo> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/liquidity");
      if (res.ok) return await res.json();
    } catch {}
  }
  try {
    // These are token account addresses that hold BUNKER in liquidity pools
    // Raydium pool token account: Gpb5ADcBXuu2komURWXrAf9UZjM1UfBuYSTfVSiDe4M6
    // Meteora DLMM V1 pool token account: DjY4XrZZWMLxo13MZ6fU6qcoHX5ZuiJXTgBnE6of1T7B
    const tokenAccountAddresses: { address: string; platform: "Raydium" | "Meteora" }[] = [
      { address: "Gpb5ADcBXuu2komURWXrAf9UZjM1UfBuYSTfVSiDe4M6", platform: "Raydium" },
      { address: "DjY4XrZZWMLxo13MZ6fU6qcoHX5ZuiJXTgBnE6of1T7B", platform: "Meteora" }
    ]

    const pools: LiquidityPool[] = []
    let totalBunkerInLiquidity = 0

    for (const { address: accountAddress, platform } of tokenAccountAddresses) {
      try {
        // Get parsed account info for the token account
        const accountInfo = await getConnection().getParsedAccountInfo(new PublicKey(accountAddress))
        
        if (accountInfo.value?.data && typeof accountInfo.value.data === 'object' && 'parsed' in accountInfo.value.data) {
          const parsed = accountInfo.value.data.parsed
          
          if (parsed.info && parsed.info.mint === BUNKER_MINT.toBase58()) {
            // This is a BUNKER token account, get the balance
            const balance = Number(parsed.info.tokenAmount.amount)
            totalBunkerInLiquidity += balance

            pools.push({
              platform,
              address: accountAddress,
              amount: balance / Math.pow(10, DECIMALS)
            })
          }
        }
      } catch (error) {
        console.error(`Error fetching balance for token account ${accountAddress}:`, error)
      }
    }

    // Convert from raw amount to BUNKER (6 decimals)
    return {
      total: totalBunkerInLiquidity / Math.pow(10, DECIMALS),
      pools
    }
  } catch (error) {
    console.error("Error fetching liquidity pool data:", error)
    return { total: 0, pools: [] }
  }
} 