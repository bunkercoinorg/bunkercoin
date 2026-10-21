import React from 'react';

const FAQ: React.FC = () => {
    const parseLinks = (text: string) => {
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = linkRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }

            parts.push(
                <a
                    key={match.index}
                    href={match[2]}
                    className="text-emerald-400 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {match[1]}
                </a>
            );

            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }

        return <>{parts}</>;
    };

    const faqItems = [
        {
            question: "What is BunkerCoin?",
            answer: "BunkerCoin is building Crypto's Resilience Layer. It consists of two main components: a blockchain that operates on shortwave radio signals, independent of the internet, and a network of physical safe havens, including the world's largest privately-owned bunker."
        },
        {
            question: "A blockchain on radio waves? How does that work?",
            answer: "Our nodes communicate using shortwave radio instead of the internet. This creates a censorship-resistant and highly resilient network that can operate even during widespread internet outages. It's designed for robustness, not high-frequency trading."
        },
        {
            question: "What's the point if it's slower than other blockchains?",
            answer: "The primary use case is resilience, not speed. BunkerCoin is designed to be a 'lifeboat' for digital assets. When other chains might be inaccessible due to internet censorship or infrastructure failure, BunkerCoin is built to remain operational. Our long-term goal is to match Bitcoin's TPS."
        },
        {
            question: "Is this technology real? Who is behind it?",
            answer: "Yes. The concept was detailed in a technical abstract by Solana co-founder Anatoly Yakovenko. Our team has built a working, simulated version of the network which you can view on our [explorer](https://explorer.bunkercoin.io/). We are now building the physical hardware nodes for the testnet."
        },
        {
            question: "How can I use BunkerCoin if I don't have a radio node?",
            answer: "The network is a hybrid. Nodes communicate via radio waves but also have optional internet gateways. This means you can interact with the BunkerCoin blockchain just like any other, using your regular devices, while benefiting from the resilience of the underlying radio network."
        },
        {
            question: "What is the role of the bunker?",
            answer: "The bunker is the first of our physical safe havens, representing the physical component of our resilience layer. While the blockchain protects your digital assets, our safe havens are being developed to protect people. Access and rights to these spaces are managed via NFTs on our chain."
        },
        {
            question: "What is the utility of the $BUNKER token?",
            answer: "The token is used for network transaction fees, participating in governance via the DAO, staking to secure the network, and as the primary currency within our safe haven ecosystem (e.g., for NFT-based access rights)."
        },
        {
            question: "How does this relate to Solana?",
            answer: "Our consensus mechanism is an adapted version of Alpenglow, a next-generation protocol being developed for Solana. We are also building a bridge to allow seamless asset transfers to and from the Solana ecosystem, making BunkerCoin a key resilience layer for the Solana community and beyond."
        }
    ];

    return (
        <>
            {faqItems.map((item, index) => (
                <div key={index} className={"mt-3"}>
                    <div className="font-bold mb-1.5">{index + 1}. {item.question}</div>
                    <div className={"text-neutral-400 text-sm"}>{parseLinks(item.answer)}</div>
                </div>
            ))}
        </>
    );
};

export default FAQ;