import React from 'react';
import BuyNowButton from "@/components/ui-wrapper/buy-now-button";

// todo @ elia -> generic component for the individual steps
const HowToBuy = () => {
    return (
        <div className={"w-full gap-y-2 flex flex-col pt-4"}>
            <div className={"bg-neutral-900 rounded-lg px-6 py-6 relative"}>
                <div className={"flex flex-row items-center"}>
                    <span className={"font-bold text-neutral-600 text-5xl"}>
                        1
                    </span>
                    <span className={"text-xl font-semibold ml-4"}>
                        Wallet Setup
                    </span>
                </div>
                <span className={"text-neutral-400"}>
                    Setup a Solana wallet, if you don&apos;t have one already. We recommend Phantom:
                    <a href={"https://phantom.app"} target={"_blank"}
                       className={"mt-2 bg-[#AB9FF2] font-semibold flex text-white w-1/2 md:w-1/3 items-center justify-center rounded-lg"}>
                        <img
                        className={"size-10"} src={"/img/phantom-logo.svg"}></img>Phantom</a>
                </span>
            </div>
            <div className={"bg-neutral-900 rounded-lg px-6 py-6 relative"}>
                <div className={"flex flex-row items-center"}>
                    <span className={"font-bold text-neutral-600 text-5xl"}>
                        2
                    </span>
                    <span className={"text-xl font-semibold ml-4"}>
                        Wallet Funding
                    </span>
                </div>
                <span className={"text-neutral-400"}>
                    To buy BunkerCoin, you need Solana in your wallet.
                    You can get Solana by purchasing it on an Exchange such as <a
                    href={"https://binance.com"} target={"_blank"} className={"text-emerald-400 hover:underline"}>Binance</a>, <a href={"https://coinbase.com"} target={"_blank"} className={"text-emerald-400 hover:underline"}>Coinbase</a>, or <a href={"https://kraken.com"} target={"_blank"} className={"text-emerald-400 hover:underline"}>Kraken</a>.
                    <br /><br />Alternatively, you can load up Solana via Credit Card directly in the Phantom Wallet, by clicking the &apos;Buy&apos; Button:
                    <img src={"/img/phantom-buy-button.png"} className={"mt-2 opacity-80 rounded-lg"} />
                </span>
            </div>
            <div className={"bg-neutral-900 rounded-lg px-6 py-6 relative"}>
                <div className={"flex flex-row items-center"}>
                    <span className={"font-bold text-neutral-600 text-5xl"}>
                        3
                    </span>
                    <span className={"text-xl font-semibold ml-4"}>
                        BunkerCoin Purchase
                    </span>
                </div>
                <span className={"text-neutral-400"}>
                    To purchase Bunkercoin, click the Link below.
                    Then, click &apos;Connect Wallet&apos; in the top right corner.
                    Select your wallet.
                    Click &apos;Buy&apos;, enter your amount, and SEND IT! 🚀<br /><br />
                    <BuyNowButton />
                </span>
            </div>
        </div>
    );
};

export default HowToBuy;