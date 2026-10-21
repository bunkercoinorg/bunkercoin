import { Link } from "@/components/bc/link";
import { Shell } from "@/components/bc/shell";
import { SITE } from "@/lib/site";

export default function NotFound() {
    return (
        <Shell>
            <div className="bc-col-gate">
                <div className="bc-spn" data-state="notfound">
                    <h1 className="bc-t2">Page not found.</h1>
                    <p className="bc-small">Nothing lives at this address.</p>
                    <div className="bc-acts">
                        <Link className="bc-btn" href="/">home</Link>
                        <a className="bc-btn" data-variant="ghost" href={SITE.explorer}>explorer ↗</a>
                    </div>
                </div>
            </div>
        </Shell>
    );
}
