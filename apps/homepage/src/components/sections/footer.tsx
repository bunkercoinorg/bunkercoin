import Link from "next/link";

const Footer: React.FC = () => {

    return (
        <>
        <span className={"text-sm text-neutral-600 mt-7"}>
            <span className={"font-bold"}>Disclaimer:</span><br/>
            BunkerCoin is a meme token created for entertainment and community engagement. It is not an investment opportunity, security, or real estate asset. Purchasing BunkerCoin involves high risk, including the potential total loss of your investment.

Ownership of BunkerCoin does not grant rights to any property. Bunker spaces will later be available for purchase via Bunker NFTs. At least 15% of the token supply (see tokenomics), and potentially additional profits, will be reinvested into the bunker project and other secure locations.

By purchasing BunkerCoin, you accept all associated risks and acknowledge its speculative nature.
        </span>
        <div
            className={"mt-4 z-10 w-full text-sm text-neutral-700 flex flex-col gap-y-3 md:gap-y-0 md:flex-row justify-around p-8"}>
            <span>Copyright © 2025 - BunkerCoin. All Rights Reserved.</span>
            <div
                className={"flex justify-between pr-8 md:pr-0 *:underline md:*:no-underline md:justify-center gap-x-2"}>
                <Link className={"hover:text-neutral-600"} href={"/legal/imprint"}>Imprint</Link>
                <Link className={"hover:text-neutral-600"} href={"/legal/privacy-policy"}>Privacy Policy</Link>
            </div>
        </div>
        </>)
}

export default Footer;

