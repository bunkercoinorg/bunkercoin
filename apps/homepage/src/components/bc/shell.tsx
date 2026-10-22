import { BrandMark } from "@/components/bc/brand-mark";
import { Link } from "@/components/bc/link";
import { SITE } from "@/lib/site";

type Current = "whitepaper" | undefined;

export function SiteHeader({ current }: { current?: Current }) {
    return (
        <header className="bc-hd">
            <div className="bc-wrap bc-hd-in">
                <Link className="bc-brand" href="/"><BrandMark /><span>BunkerCoin</span></Link>
                <span className="bc-tag" data-tone="live"><i />private testnet</span>
                <nav className="bc-nav" aria-label="site">
                    <a href={SITE.explorer}>explorer ↗</a>
                    <a href={SITE.wallet}>wallet ↗</a>
                    <Link href="/whitepaper" aria-current={current === "whitepaper" ? "page" : undefined}>whitepaper</Link>
                    <a href={SITE.github}>source ↗</a>
                </nav>
            </div>
        </header>
    );
}

export function SiteFooter() {
    return (
        <footer className="bc-ft">
            <div className="bc-wrap bc-ft-in">
                <span className="bc-brand"><BrandMark /><span>BunkerCoin</span></span>
                <span>alpenglow over hf radio · © 2026</span>
                <nav aria-label="footer">
                    <a href={SITE.x}>x ↗</a>
                    <a href={SITE.telegram}>telegram ↗</a>
                    <a href={SITE.discord}>discord ↗</a>
                    <Link href="/legal/imprint">imprint</Link>
                    <Link href="/legal/privacy-policy">privacy</Link>
                </nav>
            </div>
        </footer>
    );
}

export function Shell({ current, children }: { current?: Current; children: React.ReactNode }) {
    return (
        <div className="bc-app">
            <a className="bc-skip" href="#main">skip to content</a>
            <SiteHeader current={current} />
            <main id="main" className="bc-main">
                <div className="bc-wrap">{children}</div>
            </main>
            <SiteFooter />
        </div>
    );
}
