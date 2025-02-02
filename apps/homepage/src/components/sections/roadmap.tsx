import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle } from 'lucide-react';

interface Milestone {
    title: string;
    description: string;
}

interface RoadmapSection {
    quarter: string;
    milestones: Milestone[];
}

interface RoadmapSectionProps extends RoadmapSection {
    isCompleted?: boolean;
}

const RoadmapSection: React.FC<RoadmapSectionProps> = ({
                                                           quarter,
                                                           milestones,
                                                           isCompleted = false
                                                       }) => (
    <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-8 h-full w-px bg-neutral-800" />

        <Card className="mb-8 border-neutral-700 bg-neutral-900/50 backdrop-blur">
            <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="rounded-full bg-emerald-500/10 p-2">
                        {isCompleted ? (
                            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                        ) : (
                            <Circle className="h-6 w-6 text-emerald-500" />
                        )}
                    </div>
                    <h3 className="text-xl font-semibold text-neutral-200">{quarter}</h3>
                </div>

                <ul className="space-y-4 ml-4 md:ml-12">
                    {milestones.map((milestone, index) => (
                        <li key={index} className="text-neutral-300">
                            <h4 className="font-medium mb-2">{milestone.title}</h4>
                            <p className="text-sm text-neutral-400">{milestone.description}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </Card>
    </div>
);

const roadmapData: RoadmapSection[] = [
    {
        quarter: 'Q1 2025',
        milestones: [
            {
                title: 'Launch on Pumpfun',
                description: "BunkerCoin's launch on Pumpfun marks the first milestone, providing the initial public opportunity to invest in the token and expand the community."
            },
            {
                title: 'Listings on Dextools, Moontok, CoinMarketCap',
                description: 'BunkerCoin will be listed on major crypto platforms to increase visibility and promote token trading.'
            },
            {
                title: 'Partnering with Influencers and KOLs',
                description: 'Establish partnerships with influencers and Key Opinion Leaders (KOLs) to raise project awareness within the crypto and lifestyle communities.'
            },
            {
                title: 'Community Event in the Bunker',
                description: 'Start hosting closed community events at the bunker to engage the community directly and further promote the project.'
            }
        ]
    },
    {
        quarter: 'Q2 2025',
        milestones: [
            {
                title: 'Exchange Listings',
                description: 'Secure additional listings on larger crypto exchanges to enhance token liquidity and accessibility.'
            },
            {
                title: 'Launch Bunker NFTs',
                description: 'Introduce Bunker NFTs to support the community and generate revenue for the project.'
            },
            {
                title: 'Start Renovating the Bunker',
                description: 'Begin renovation of the bunker, a key physical asset of the project. These renovations will be documented and made transparent.'
            },
            {
                title: 'Start App Development',
                description: 'Develop an app that allows the community to interact directly with the BunkerCoin ecosystem and invest seamlessly.'
            },
            {
                title: 'Implementing DAO',
                description: 'Establish a Decentralized Autonomous Organization (DAO) to give the community a voice and influence over important decisions.'
            }
        ]
    },
    {
        quarter: 'Coming Soon',
        milestones: [
            {
                title: 'Further Objectives',
                description: "The team's amount of ideas for new projects and objectives is pretty plenty and certainly not the limiting factor. More to be announced soon!"
            },
        ]
    }
];

interface RoadmapProps {
    className?: string;
}

const Roadmap: React.FC<RoadmapProps> = ({ className = '' }) => {
    return (
        <div className={`mt-6 space-y-6 ${className}`}>
            <div className="space-y-2">
                {roadmapData.map((section, index) => (
                    <RoadmapSection
                        key={index}
                        quarter={section.quarter}
                        milestones={section.milestones}
                        isCompleted={false}
                    />
                ))}
            </div>
        </div>
    );
};

export default Roadmap;