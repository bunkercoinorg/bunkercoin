import { notFound, redirect } from "next/navigation";
import { BYPASS_PARAM, withBypass } from "@/lib/gate";

const DOCUMENTS: Record<string, string> = {
    "land-registry": "https://assets.bunkercoin.com/docs/land-registry.pdf",
    "trade-register": "https://assets.bunkercoin.com/docs/trade-register.pdf",
};

type Params = Record<string, string | string[] | undefined>;

export default async function View({ searchParams }: { searchParams: Promise<Params> }) {
    const params = await searchParams;
    const file = typeof params.file === "string" ? params.file : "";
    if (file === "technical-whitepaper") {
        const bypass = params[BYPASS_PARAM];
        redirect(withBypass("/whitepaper", bypass === undefined ? null : String(bypass)));
    }
    const url = DOCUMENTS[file];
    if (!url) notFound();
    redirect(url);
}
