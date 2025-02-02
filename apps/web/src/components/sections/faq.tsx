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
            answer: "BunkerCoin is a project that creates safe havens in times of uncertainty and crisis. The focus is on the renovation and modernisation of the world's largest private bunker facility near Berlin (750’000 sqft of bunker space + 10’700’000 sqft of land above), which is designed to offer maximum protection. In addition, we will be developing an app that provides early warnings in the event of a crisis and efficiently coordinates evacuations, as well as enabling backup communication between the community. In the future, we also plan to offer customised panic rooms as well as private security services to provide the best possible support for the evacuation and safety of our community members. In the long term, we are planning further projects, such as in The Gambia, the friendliest and most peaceful country in Africa."
        },
        {
            question: "How to become part of the BunkerCoin community?",
            answer: "As of now, you can become a member by purchasing BunkerCoin tokens and participating in our community events. You can also use BunkerCoins to buy Bunker NFTs in the future, which will secure you a place in the bunker."},
        {
            question: "Can I visit the bunker?",
            answer: "Of course you can visit and take a look at the bunker - register [here](https://thebunker.community) for a tour. However, keep in mind that tours are only organised exclusively for BunkerCoin and NFT holders."},
        {
            question: "What are Bunker-NFTs?",
            answer: "With the bunker NFTs you can secure access to space in the bunker for emergencies, or space to safely store things that are important to you in the largest private bunker facility in the world. Access to your personal space in the bunker!"},
        {
            question: "Will the Bunker-NFTs be tradable?",
            answer: "Even if you don't want access to bunker space, you can still freely trade the Bunker-NFTs, e.g. as a hedge against crisis, to profit from rising prices."},

        {
            question: "When will the Bunker-NFTs be released?",
            answer: "The exact timing will depend on the success and momentum of the project. However, as stated in the roadmap, we have planned to release the NFTs in the second quarter of 2025."
        },
        {
            question: "How is the renovation of the bunker being financed?",
            answer: "The renovation and modernisation will be financed by the 15% renovation allocation and a portion of the proceeds from the sale of NFTs. The more successful the coin, the more is invested in the bunker."
        },
        {
            question: "Are there events I can take part in?",
            answer: "Yes, we organise closed community events in the bunker where members have the opportunity to interact directly with our team and learn more about the project."
        },
        {
            question: "How can I interact with the BunkerCoin community?",
            answer: "Join our [Telegram community](https://links.bunkercoin.io/telegram)!"
        },
        {
            question: "Is the bunker facility real?",
            answer: "Yes, the bunker is real and in our possession. Just google 'Bunker code name Malachit' or look it up in Wikipedia"},
        {
            question: "How does BunkerCoin ensure transparency?",
            answer: "We document all renovation progress and keep the community informed of all important decisions. A Decentralised Autonomous Organisation (DAO) will also allow the community to influence important decisions."
        },
        {
            question: "Can I search for hidden treasures in the bunker complex, such as the old GDR money or the Amber Room?",
            answer: "Yes, you can ^^"
        },
        {
            question: "Where can I find more information?",
            answer: "Further information can be found in our [whitepaper](/whitepaper), and on our social media channels. Stay tuned for updates and new announcements!"
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