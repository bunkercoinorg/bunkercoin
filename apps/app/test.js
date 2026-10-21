import { Connection, PublicKey } from "@solana/web3.js";

// RPC endpoint
const RPC = "https://solana-rpc.publicnode.com";
const connection = new Connection(RPC, "confirmed");

// BUNKER mint
const BUNKER_MINT = new PublicKey("8NCievmJCg2d9Vc2TWgz2HkE6ANeSX7kwvdq5AL7pump");
const DECIMALS = 6;
const ORIGINAL_TOTAL_SUPPLY = 1_000_000_000; // 1 billion BUNKER

// Common burn addresses on Solana
const BURN_ADDRESSES = [
  "11111111111111111111111111111111", // System program (common burn)
  "1nc1nerator11111111111111111111111111111111", // Incinerator
  "BurnDustBBjuVu4dkXS6UpwUjTgQDYGDzp8fh9mAy4", // Burn dust
  "So11111111111111111111111111111111111111112", // Wrapped SOL (sometimes used)
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // All A's
  "0000000000000000000000000000000000000000000", // All 0's
];

async function checkBurnedTokens() {
  console.log("\n=== CHECKING BURNED TOKENS ===");
  console.log(`BUNKER MINT: ${BUNKER_MINT.toBase58()}`);
  console.log(`Original total supply: ${ORIGINAL_TOTAL_SUPPLY.toLocaleString()}`);
  
  try {
    // Method 1: Check current total supply vs original
    console.log("\n--- METHOD 1: Total Supply Check ---");
    const mintInfo = await connection.getParsedAccountInfo(BUNKER_MINT);
    
    if (mintInfo.value?.data && typeof mintInfo.value.data === 'object' && 'parsed' in mintInfo.value.data) {
      const parsed = mintInfo.value.data.parsed;
      console.log("Mint info:", JSON.stringify(parsed, null, 2));
      
      if (parsed.info) {
        const currentSupply = Number(parsed.info.supply) / Math.pow(10, DECIMALS);
        const mintAuthority = parsed.info.mintAuthority;
        const freezeAuthority = parsed.info.freezeAuthority;
        
        console.log(`Current total supply: ${currentSupply.toLocaleString()}`);
        console.log(`Mint authority: ${mintAuthority}`);
        console.log(`Freeze authority: ${freezeAuthority}`);
        
        const supplyDifference = ORIGINAL_TOTAL_SUPPLY - currentSupply;
        console.log(`Supply difference (burned via mint): ${supplyDifference.toLocaleString()}`);
        
        if (supplyDifference > 0) {
          console.log(`✅ ${supplyDifference.toLocaleString()} BUNKER burned via supply reduction`);
        } else {
          console.log(`❌ No tokens burned via supply reduction`);
        }
      }
    }

    // Method 2: Check burn addresses
    console.log("\n--- METHOD 2: Burn Address Check ---");
    let totalBurnedInAddresses = 0;
    
    for (const burnAddress of BURN_ADDRESSES) {
      try {
        console.log(`\nChecking burn address: ${burnAddress}`);
        
        // Try to get BUNKER token accounts for this address
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          new PublicKey(burnAddress),
          { mint: BUNKER_MINT }
        );
        
        if (tokenAccounts.value.length > 0) {
          for (const account of tokenAccounts.value) {
            const balance = Number(account.account.data.parsed.info.tokenAmount.amount);
            const bunkerAmount = balance / Math.pow(10, DECIMALS);
            
            console.log(`  ✅ Found ${bunkerAmount.toLocaleString()} BUNKER in burn address`);
            totalBurnedInAddresses += bunkerAmount;
          }
        } else {
          console.log(`  No BUNKER found in this burn address`);
        }
      } catch (error) {
        console.log(`  Error checking ${burnAddress}: ${error.message}`);
      }
    }
    
    console.log(`\nTotal burned in burn addresses: ${totalBurnedInAddresses.toLocaleString()}`);

    // Method 3: Look for suspicious addresses with large amounts
    console.log("\n--- METHOD 3: Looking for Potential Burn Addresses ---");
    
    // This is a more manual approach - we'd need to scan through top holders
    // and identify addresses that look like burn addresses or have burned tokens
    
    console.log("\n=== BURN SUMMARY ===");
    console.log(`Total burned via supply reduction: Unknown (need current supply)`);
    console.log(`Total burned in known burn addresses: ${totalBurnedInAddresses.toLocaleString()}`);
    
    return {
      burnedViaSupply: 0, // We'll calculate this after getting mint info
      burnedInAddresses: totalBurnedInAddresses,
      totalBurned: totalBurnedInAddresses
    };
    
  } catch (error) {
    console.error("Error checking burned tokens:", error);
    return { burnedViaSupply: 0, burnedInAddresses: 0, totalBurned: 0 };
  }
}

async function checkTokenAccountBalances() {
  console.log("\n=== CHECKING TOKEN ACCOUNT BALANCES ===");
  console.log(`BUNKER MINT: ${BUNKER_MINT.toBase58()}`);
  
  const tokenAccounts = [
    "Gpb5ADcBXuu2komURWXrAf9UZjM1UfBuYSTfVSiDe4M6", // Raydium pool token account
    "DjY4XrZZWMLxo13MZ6fU6qcoHX5ZuiJXTgBnE6of1T7B"  // Meteora DLMM V1 pool token account
  ];

  let totalLiquidity = 0;

  for (const accountAddress of tokenAccounts) {
    console.log(`\n--- TOKEN ACCOUNT: ${accountAddress} ---`);
    
    try {
      // Get parsed account info for the token account
      const accountInfo = await connection.getParsedAccountInfo(new PublicKey(accountAddress));
      
      if (accountInfo.value?.data && typeof accountInfo.value.data === 'object' && 'parsed' in accountInfo.value.data) {
        const parsed = accountInfo.value.data.parsed;
        
        if (parsed.info && parsed.info.mint === BUNKER_MINT.toBase58()) {
          // This is a BUNKER token account, get the balance
          const balance = Number(parsed.info.tokenAmount.amount);
          const bunkerAmount = balance / Math.pow(10, DECIMALS);
          console.log(`  ✅ BUNKER amount: ${bunkerAmount.toLocaleString()}`);
          totalLiquidity += bunkerAmount;
        } else {
          console.log(`  ❌ Not a BUNKER account (mint: ${parsed.info?.mint})`);
        }
      }
    } catch (error) {
      console.error(`  ❌ Error checking account ${accountAddress}:`, error.message);
    }
  }

  console.log(`\n=== LIQUIDITY SUMMARY ===`);
  console.log(`Total BUNKER in liquidity pools: ${totalLiquidity.toLocaleString()}`);
  
  return totalLiquidity;
}

(async () => {
  await checkBurnedTokens();
  await checkTokenAccountBalances();
})();