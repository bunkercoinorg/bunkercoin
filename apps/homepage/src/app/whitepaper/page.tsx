import type { Metadata } from "next";
import { Link } from "@/components/bc/link";
import { Shell } from "@/components/bc/shell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Whitepaper · BunkerCoin" };

export default function Whitepaper() {
    return (
        <Shell current="whitepaper">
            <div className="bc-col-form bc-stack bc-gap24">
                <Link className="bc-mini" href="/">← home</Link>
                <div>
                    <span className="bc-lbl">technical paper · pdf</span>
                    <h1 className="bc-t1">The BunkerCoin whitepaper.</h1>
                    <p className="bc-lead">How the chain reaches consensus over HF radio: the radio link, Alpenglow on a slow channel, and what it costs.</p>
                </div>
                <dl className="bc-fx">
                    <div><dt>format</dt><dd>pdf <span className="bc-s">· opens in the browser</span></dd></div>
                    <div><dt>source</dt><dd><a className="bc-lnk" href={SITE.github}>github.com/bunkercoinorg</a></dd></div>
                </dl>
                <div className="bc-acts">
                    <a className="bc-btn" href={SITE.paper}>open the pdf ↗</a>
                    <a className="bc-btn" data-variant="ghost" href={SITE.paper} download="bunker_coin.pdf">download</a>
                    <a className="bc-btn" data-variant="quiet" href={SITE.explorer}>explorer ↗</a>
                </div>
            </div>
        </Shell>
    );
}
