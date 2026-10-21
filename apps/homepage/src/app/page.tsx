import { headers } from "next/headers";
import { CopyValue } from "@/components/bc/copy-value";
import { GlobeIsland } from "@/components/bc/globe-island";
import { Link } from "@/components/bc/link";
import { LiveFacts } from "@/components/bc/live-facts";
import { Shell } from "@/components/bc/shell";
import { XPixel } from "@/components/bc/x-pixel";
import { MARKET_HIDDEN, SITE, TOKEN_CONTRACT } from "@/lib/site";

const LIVE = [
    { lbl: "explorer", tag: "live", title: "Every block, as it lands.", body: "Blocks, transactions, tokens and the radio link, read from the testnet.", href: SITE.explorer, go: "explorer.bunkercoin.com ↗" },
    { lbl: "wallet", tag: "live", title: "Send test BUNKER.", body: "Create a wallet in the browser, take coins from the faucet, send them, make a token.", href: SITE.wallet, go: "wallet.bunkercoin.com ↗" },
    { lbl: "radio lab", tag: "live", title: "Watch the radios.", body: "A live camera on the transceivers and modems that carry the chain.", href: SITE.stream, go: "watch on the explorer ↗" },
    { lbl: "whitepaper", tag: "pdf", title: "How it works, in full.", body: "The radio link, the consensus and the numbers behind them.", href: "/whitepaper", go: "read the paper →" },
    { lbl: "source", tag: "open", title: "Read the code.", body: "Node, wallet and explorer, developed in public.", href: SITE.github, go: "github.com/bunkercoinorg ↗" },
] as const;

const HOW = [
    { title: "Over the air.", body: "Validators send blocks and votes as PACTOR frames on HF radio. Shortwave reflects off the ionosphere, so one link can span a continent." },
    { title: "Alpenglow, adapted.", body: "Solana's new consensus protocol, tuned for a link that carries a few kilobits a second. A block is notarized, then finalized. A missed slot gets a skip certificate." },
    { title: "Gateways for people.", body: "Wallets and the explorer reach the chain through internet gateways. The validators don't need the internet to agree." },
];

async function showToken() {
    if (MARKET_HIDDEN.size === 0) return true;
    return !MARKET_HIDDEN.has((await headers()).get("cf-ipcountry") ?? "");
}

export default async function Home() {
    const token = await showToken();
    return (
        <Shell>
            <XPixel />
            <section className="bc-hp-hero">
                <div>
                    <span className="bc-lbl">layer 1 · hf radio · private testnet</span>
                    <h1>The blockchain that runs over shortwave radio.</h1>
                    <p className="bc-lead">BunkerCoin&apos;s validators agree on blocks over HF radio, not the internet. A private testnet runs today: Alpenglow consensus over PACTOR modems, on real airwaves.</p>
                    <div className="bc-acts">
                        <a className="bc-btn" href={SITE.explorer}>open the explorer ↗</a>
                        <a className="bc-btn" data-variant="ghost" href={SITE.wallet}>open the wallet ↗</a>
                        <Link className="bc-btn" data-variant="quiet" href="/whitepaper">read the whitepaper</Link>
                    </div>
                    <LiveFacts />
                </div>
                <GlobeIsland />
            </section>

            <section className="bc-rule bc-hp-sec" aria-labelledby="live-today">
                <div className="bc-hp-sh">
                    <h2 className="bc-t2" id="live-today">Live today.</h2>
                    <p className="bc-small">All of this works now. The testnet is private: the validators are ours, outside nodes come later.</p>
                </div>
                <div className="bc-hp-cells">
                    {LIVE.map((c) => (
                        <Link key={c.lbl} href={c.href}>
                            <span className="bc-hd2"><span className="bc-lbl">{c.lbl}</span><span className="bc-tag" data-tone={c.tag === "live" ? "live" : undefined}>{c.tag === "live" && <i />}{c.tag}</span></span>
                            <span className="bc-t3">{c.title}</span>
                            <span className="bc-small">{c.body}</span>
                            <span className="bc-go">{c.go}</span>
                        </Link>
                    ))}
                    <div className="bc-off">
                        <span className="bc-hd2"><span className="bc-lbl">run a node</span><span className="bc-tag" data-tone="unknown">not yet</span></span>
                        <span className="bc-t3">Outside validators.</span>
                        <span className="bc-small">Opens after the private testnet. Follow along on X or Telegram.</span>
                        <span className="bc-go">not open yet</span>
                    </div>
                </div>
            </section>

            <section className="bc-rule bc-hp-sec" aria-labelledby="how-it-works">
                <div className="bc-hp-sh">
                    <h2 className="bc-t2" id="how-it-works">How it works.</h2>
                    <p className="bc-small">Three parts. The whitepaper has the detail.</p>
                </div>
                <div className="bc-hp-cells bc-hp-how">
                    {HOW.map((h, i) => (
                        <div key={h.title}>
                            <span className="bc-n">{String(i + 1).padStart(2, "0")}</span>
                            <span className="bc-t3">{h.title}</span>
                            <span className="bc-small">{h.body}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="bc-rule bc-hp-sec" aria-labelledby="bunker">
                <div className="bc-hp-bk">
                    <div className="bc-stack bc-gap12">
                        <span className="bc-lbl">bunker</span>
                        <h2 className="bc-t2" id="bunker">We own a bunker in Germany.</h2>
                        <p className="bc-small">A 70,000 m² tunnel complex near Halberstadt. It is planned as a site for radio nodes.</p>
                    </div>
                    <div className="bc-acts" data-align="end">
                        <Link className="bc-btn" data-variant="ghost" href="/view?file=land-registry">land registry ↗</Link>
                        <Link className="bc-btn" data-variant="ghost" href="/view?file=trade-register">trade register ↗</Link>
                    </div>
                </div>
            </section>

            {token && (
                <section className="bc-rule bc-hp-sec" aria-labelledby="token">
                    <div className="bc-hp-tk">
                        <div className="bc-stack bc-gap12">
                            <span className="bc-lbl">token</span>
                            <h2 className="bc-t2" id="token">BUNKER.</h2>
                            <p className="bc-small">The BUNKER token trades on Solana. The BUNKER in the testnet wallet is test money: a separate asset with no value.</p>
                            <p className="bc-hp-disc">BUNKER is a meme token. It is not an investment, a security or a claim on any property. You can lose everything you spend on it.</p>
                        </div>
                        <div className="bc-stack bc-gap16">
                            <dl className="bc-fx" data-columns="1">
                                <div><dt>chain</dt><dd>Solana</dd></div>
                                <div><dt>contract</dt><dd><CopyValue value={TOKEN_CONTRACT} label="contract" /></dd></div>
                            </dl>
                            <div className="bc-acts">
                                <a className="bc-btn" href={SITE.jupiter}>buy on jupiter ↗</a>
                                <a className="bc-btn" data-variant="ghost" href={SITE.coinmarketcap}>coinmarketcap ↗</a>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </Shell>
    );
}
