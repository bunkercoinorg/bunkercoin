import { Connection, PublicKey } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { Buffer } from "buffer"

// Initialize Solana connection with PublicNode endpoint
const connection = new Connection("https://solana-rpc.publicnode.com", "confirmed")

// BUNKER token mint address
const BUNKER_MINT = new PublicKey("8NCievmJCg2d9Vc2TWgz2HkE6ANeSX7kwvdq5AL7pump")

// Constants
const TOTAL_SUPPLY = 1_000_000_000 // 1 billion BUNKER
const DECIMALS = 6 // BUNKER has 6 decimals

export interface TokenBalance {
  address: string
  balance: number
  percentage: number
}

export async function getTokenBalance(walletAddress: string): Promise<number> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
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
    const tokenAccounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
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
    const tokenAccounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
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