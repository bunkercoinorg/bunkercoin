export const SITE = {
    explorer: "https://explorer.bunkercoin.com",
    stream: "https://explorer.bunkercoin.com/stream",
    wallet: "https://wallet.bunkercoin.com",
    github: "https://github.com/bunkercoinorg/bunkercoin",
    x: "https://x.com/bunkercoin_io",
    telegram: "https://t.me/bunkercoin_io",
    discord: "https://discord.gg/DGBqm92VQm",
    jupiter: "https://jup.ag/swap/SOL-BUNKER",
    coinmarketcap: "https://coinmarketcap.com/currencies/bunkercoin",
    paper: "/whitepaper/bunker_coin.pdf",
    api: process.env.NEXT_PUBLIC_API_URL || "https://api.bunkercoin.com",
} as const;

export const TOKEN_CONTRACT = "8NCievmJCg2d9Vc2TWgz2HkE6ANeSX7kwvdq5AL7pump";

// Countries that do not see the token section; new Set(EU_27) would restore the old market scope.
export const MARKET_HIDDEN = new Set<string>([]);
