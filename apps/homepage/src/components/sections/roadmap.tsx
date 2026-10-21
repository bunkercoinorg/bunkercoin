import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface Milestone {
    title: string;
    description: string;
    isCompleted: boolean;
    inProgress?: boolean; // Added in-progress status for individual milestones
    progressPercent?: number; // Added progress percentage for in-progress milestones
}

interface RoadmapSection {
    quarter: string;
    milestones: Milestone[];
    isCompleted: boolean;
}

interface RoadmapSectionProps extends RoadmapSection {
    isActive: boolean;
}

const RoadmapSection: React.FC<RoadmapSectionProps> = ({
                                                           quarter,
                                                           milestones,
                                                           isCompleted,
                                                           isActive
                                                       }) => (
    <div className="relative">
        {/* Vertical line - changes color based on completion status */}
        <div className={`absolute left-4 top-8 h-full w-px ${
            isCompleted ? 'bg-emerald-500' :
                isActive ? 'bg-gradient-to-b from-emerald-500 to-neutral-800' :
                    'bg-neutral-800'}`}
        />

        <Card className={`mb-8 border-neutral-700 ${
            isActive ? 'bg-neutral-900/70 ring-1 ring-emerald-500/20' :
                'bg-neutral-900/50'} backdrop-blur`}
        >
            <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className={`rounded-full ${
                        isCompleted ? 'bg-emerald-500/20' :
                            isActive ? 'bg-emerald-500/10' :
                                'bg-neutral-800/50'} p-2`}
                    >
                        {isCompleted ? (
                            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                        ) : (
                            <Circle className={`h-6 w-6 ${isActive ? 'text-emerald-500' : 'text-neutral-500'}`} />
                        )}
                    </div>
                    <h3 className={`text-xl font-semibold ${isCompleted || isActive ? 'text-neutral-200' : 'text-neutral-400'}`}>
                        {quarter}
                    </h3>
                    {isActive && (
                        <span className="text-xs font-medium bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full">
                            Current
                        </span>
                    )}
                </div>

                <ul className="space-y-4 ml-4 md:ml-12">
                    {milestones.map((milestone, index) => (
                        <li key={index} className={`${
                            milestone.isCompleted ? 'text-neutral-300' :
                                milestone.inProgress ? 'text-amber-100' :
                                    isActive ? 'text-neutral-400' :
                                        'text-neutral-500'}`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                {milestone.isCompleted ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                ) : milestone.inProgress ? (
                                    <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
                                ) : (
                                    <Circle className={`h-4 w-4 ${isActive ? 'text-neutral-400' : 'text-neutral-600'} flex-shrink-0`} />
                                )}
                                <h4 className="font-medium">
                                    {milestone.title}
                                </h4>
                            </div>
                            <p className={`text-sm ml-6 ${
                                milestone.isCompleted ? 'text-neutral-400' :
                                    milestone.inProgress ? 'text-amber-200/70' :
                                        'text-neutral-500'}`}
                            >
                                {milestone.description}
                            </p>
                            {milestone.inProgress && (
                                <div className="ml-6 mt-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-amber-300">{milestone.progressPercent || 50}% Complete</span>
                                    </div>
                                    <div className="w-full bg-neutral-700 rounded-full h-1.5">
                                        <div
                                            className="bg-gradient-to-r from-amber-500 to-amber-300 h-1.5 rounded-full"
                                            style={{ width: `${milestone.progressPercent || 50}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
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
        isCompleted: true,
        milestones: [
            {
                title: 'Launch on Pumpfun',
                description: "BunkerCoin's launch on Pumpfun marks the first milestone, providing initial publicity and exposure to the project, as well as realizing a fair launch-mechanism.",
                isCompleted: true
            },
            {
                title: 'Listings on Dextools, Moontok, CoinMarketCap',
                description: 'BunkerCoin will be listed on major crypto platforms to increase visibility and promote token trading.',
                isCompleted: true
            },
            {
                title: 'Partnering with Influencers and KOLs',
                description: 'Establish partnerships with influencers and Key Opinion Leaders (KOLs) to raise project awareness within the crypto and lifestyle communities.',
                isCompleted: true
            },
            {
                title: "Renovate the bunker's electical system",
                description: "Modernize the bunker's electrical system, including adding new generators, efficient LED lighting, scenic RGB lighting, and more",
                isCompleted: false,
                inProgress: true,
                progressPercent: 80
            },
        ]
    },
    {
        quarter: 'Q2 2025',
        isCompleted: false,
        milestones: [
            {
                title: "Renovate the bunker's blast doors",
                description: 'Renovate the blast door control system, protecting the bunker from nuclear strikes',
                isCompleted: false,
                inProgress: true,
                progressPercent: 10
            },
            {
                title: 'Develop the BunkerCoin WebApp',
                description: 'The BunkerCoin Web App in the base version includes the transparency dashboard, as well as the staking feature',
                isCompleted: false,
                inProgress: true,
                progressPercent: 85
            },
            {
                title: 'Launch scalable marketing camapigns',
                description: 'Launch scalable marketing campaigns, such as on X, via Airdrops, and by partnering up with industry giants.',
                isCompleted: false,
                inProgress: true,
                progressPercent: 40
            },
            {
                title: 'Exchange Listings',
                description: 'Secure additional listings on larger crypto exchanges to enhance token liquidity and accessibility.',
                isCompleted: false
            },
            {
                title: 'Launch Founder Edition Bunker NFTs',
                description: 'Introduce the first batch of Bunker NFTs to support early community members, supporters and whales.',
                isCompleted: false
            },
            {
                title: 'Community Event in the Bunker',
                description: 'Start hosting closed community events at the bunker to engage the community directly and further promote the project.',
                isCompleted: false,
                inProgress: true,
                progressPercent: 20
            },
            {
                title: 'Implementing DAO',
                description: 'Establish a Decentralized Autonomous Organization (DAO) to give the community a voice and influence over important decisions.',
                isCompleted: false
            }
        ]
    },
    {
        quarter: 'Coming Soon',
        isCompleted: false,
        milestones: [
            {
                title: 'Further Objectives',
                description: "The team's amount of ideas for new projects and objectives is pretty plenty and certainly not the limiting factor. More to be announced soon!",
                isCompleted: false
            },
        ]
    }
];

// Function to determine which quarter is currently active
const determineActiveQuarter = (roadmapData: RoadmapSection[]): number => {
    for (let i = 0; i < roadmapData.length; i++) {
        if (!roadmapData[i].isCompleted) {
            // Find the first uncompleted quarter that has at least one completed milestone or in-progress milestone
            if (roadmapData[i].milestones.some(milestone => milestone.isCompleted || milestone.inProgress)) {
                return i;
            }
            // If no quarters have any completed or in-progress milestones, return the first uncompleted quarter
            if (i === 0 || roadmapData[i-1].isCompleted) {
                return i;
            }
        }
    }
    // If all quarters are completed, return the last one
    return roadmapData.length - 1;
};

interface RoadmapProps {
    className?: string;
}

const Roadmap: React.FC<RoadmapProps> = ({ className = '' }) => {
    // Determine which quarter is currently active
    const activeQuarterIndex = determineActiveQuarter(roadmapData);

    return (
        <div className={`mt-6 space-y-6 ${className}`}>
            <div className={"flex items-center mb-2 gap-x-2"}>
                <div className={"size-2 rounded-full bg-neutral-700 animate-ping"}></div>
                <span className={"text-sm text-neutral-700"}>Last updated: 13.04.2024 - 19:30 CET</span>
            </div>
            <div className="space-y-2">
                {roadmapData.map((section, index) => (
                    <RoadmapSection
                        key={index}
                        quarter={section.quarter}
                        milestones={section.milestones}
                        isCompleted={section.isCompleted}
                        isActive={index === activeQuarterIndex}
                    />
                ))}
            </div>

            <div className="mt-4 p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
                <div className="flex items-center gap-3 text-sm flex-wrap">
                    <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                        <span className="text-neutral-300">Completed</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded-full bg-amber-400"></div>
                        <span className="text-neutral-300">In Progress</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded-full bg-neutral-400"></div>
                        <span className="text-neutral-300">Planned</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded-full bg-neutral-700"></div>
                        <span className="text-neutral-300">Upcoming</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Roadmap;