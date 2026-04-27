"use client"

import Footer from "@/components/sections/footer";
import LayeredIcon from "@/components/ui-wrapper/layered-icon";
import {
    BadgeInfoIcon,
    ChartNoAxesGanttIcon, DollarSignIcon,
    ExternalLinkIcon, FileTextIcon, ImagesIcon, MessageCircleQuestionIcon, NewspaperIcon,
    ShieldCheckIcon,
    SparklesIcon,
    WrenchIcon, ArrowDownIcon, ChevronDownIcon, NetworkIcon, ShieldIcon, UsersIcon, CodeIcon, RadioIcon, ZapIcon, WifiOffIcon, AlertTriangleIcon, BuildingIcon, MapPinIcon, LoaderIcon, CheckIcon, CopyIcon
} from "lucide-react";
import Roadmap from "@/components/sections/roadmap";
import LandingGallerySlideshow from "@/components/sections/gallery-slideshow";
import {SiCoinmarketcap, SiGithub, SiTelegram, SiX} from "@icons-pack/react-simple-icons";
import Link from "next/link";
import FAQ from "@/components/sections/faq";
import HowToBuy from "@/components/sections/how-to-buy";
import BuyNowButton from "@/components/ui-wrapper/buy-now-button";
import PDFButton from "@/components/ui-wrapper/pdf-button";
import MediumFeed from "@/components/sections/medium-feed";
import Header from "@/components/sections/header";
import {Suspense, useEffect, useState} from "react";
import {initX, trackXConversionOnce} from "@/components/util/x";
import dynamic from "next/dynamic";
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/audio.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaPlayerInstance,
} from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';


const InteractiveGlobe = dynamic(() => import('@/components/sections/interactive-globe'), {
    ssr: false,
    loading: () => (
        <div className="w-full max-w-md aspect-square flex flex-col items-center justify-center">
            <LoaderIcon className="w-6 h-6 text-neutral-500 animate-spin mb-2" />
            <p className="text-neutral-600 text-sm">Loading 3D visualization</p>
        </div>
    )
});

export default function Home() {
  const tokenCA = "8NCievmJCg2d9Vc2TWgz2HkE6ANeSX7kwvdq5AL7pump"

  const [copied, setCopied] = useState(false);
  const truncatedCA = `${tokenCA.slice(0,5)}...${tokenCA.slice(-5)}`;

  const copyCA = () => {
    navigator.clipboard.writeText(tokenCA).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            initX();
            trackXConversionOnce('tw-on6qi-pd16h');
            // Add smooth scroll behavior
            document.documentElement.style.scrollBehavior = 'smooth';
        }
    }, []);

    // Add intersection observer for fade-in animations
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-visible');
                }
            });
        }, { threshold: 0.1 });

        const elements = document.querySelectorAll('.fade-in');
        elements.forEach(el => observer.observe(el));

        return () => observer.disconnect();
    }, []);

  return (
      <>
          <style jsx global>{`
              .fade-in {
                  opacity: 0;
                  transform: translateY(30px);
                  transition: all 0.8s ease-out;
              }
              .fade-in-visible {
                  opacity: 1;
                  transform: translateY(0);
              }
              
              /* Custom Scrollbar Styles */
              ::-webkit-scrollbar {
                  width: 10px;
                  height: 10px;
              }
              
              ::-webkit-scrollbar-track {
                  background: #0a0a0a;
                  border-radius: 5px;
              }
              
              ::-webkit-scrollbar-thumb {
                  background: #1a1a1a;
                  border-radius: 5px;
                  border: 1px solid #0a0a0a;
              }
              
              ::-webkit-scrollbar-thumb:hover {
                  background: #2a2a2a;
              }
              
              ::-webkit-scrollbar-thumb:active {
                  background: #00FFB2;
              }
              
              /* Firefox Scrollbar */
              * {
                  scrollbar-width: thin;
                  scrollbar-color: #1a1a1a #0a0a0a;
              }
          `}</style>
          <Header></Header>
          <div className="absolute top-0 -z-10 h-screen w-full bg-black"
               style={{background: 'radial-gradient(circle at center, rgba(0, 255, 178, 0.05), #000 70%)'}}
          >
              <div className="absolute bottom-0 h-[15%] w-full bg-gradient-to-t from-neutral-950 to-transparent"/>
          </div>

          {/* Hero Section */}
          <main className="container mx-auto px-4 sm:px-6 lg:px-8">
              <section className="flex flex-col md:flex-row items-center justify-between pt-[12vh] md:pt-[16vh] gap-8 md:gap-12 px-4 md:px-0" style={{minHeight:'calc(100vh - 96px)'}}>
                  {/* Globe first on mobile, second on desktop */}
                  <div className={"w-full md:w-1/2 relative aspect-square order-1 md:order-2"}>
                      <Suspense>
                        <InteractiveGlobe/>
                      </Suspense>
              </div>
                  {/* Text second on mobile, first on desktop */}
                  <div className={"md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1"}>
                      <h1 className={"text-4xl md:text-5xl lg:text-7xl font-bold"}>Humanity&apos;s <span className="text-bunker whitespace-nowrap">Resilience Layer</span></h1>
                      <p className={"text-lg mt-6 text-neutral-400 max-w-xl"}>
                          BunkerCoin will be the first Layer 1 blockchain on radiowaves—a censorship-resistant network that operates fully independent from the internet. We anchor this groundbreaking tech with a network of physical safe havens, starting with the world&apos;s largest bunker.
                      </p>
                      <div className={"flex items-center gap-x-4 mt-8 mb-2"}>
                  <BuyNowButton/>
                  <a className={"group flex items-center gap-x-2 px-4 py-2 rounded-md bg-neutral-800/50 backdrop-blur-md border border-neutral-700 text-white hover:border-neutral-600 transition-all duration-300"}
                     href={"/view?file=technical-whitepaper"}>Technical Whitepaper<FileTextIcon
                      className={"text-neutral-600 size-5 stroke-1 group-hover:text-neutral-500 transition-all duration-300"}
                  /></a>
              </div>

              {/* Contract address */}
              <div className="mb-4">
                  <button onClick={copyCA} className="mt-4 md:mt-1 text-md md:text-base text-neutral-500 hover:text-neutral-300 transition focus:outline-none select-none inline-flex items-center gap-1" title="Click to copy contract address">
                      CA: {copied ? 'Copied!' : truncatedCA}
                      <CopyIcon className="w-3 h-3" />
                  </button>
              </div>
                      <div className={"flex justify-center md:justify-start gap-x-6 mb-8 mt-4"}>
                          <Link href={"https://github.com/TheBunkerCoin"}><SiGithub className={"size-8 opacity-50"}></SiGithub></Link>
                          <Link href={"https://x.com/bunkercoin_io"}><SiX className={"size-8 opacity-50"}></SiX></Link>
                          <Link href={"https://t.me/bunkercoin_io"}><SiTelegram
                              className={"size-8 opacity-50"}></SiTelegram></Link>
                          <Link href={"https://coinmarketcap.com/currencies/bunkercoin"}><SiCoinmarketcap
                              className={"size-8 opacity-50"}></SiCoinmarketcap></Link>
                      </div>
                  </div>
              </section>

            {/* Scroll indicator */}
            <div className="flex justify-center mt-6 animate-bounce">
                <Link href="#how-it-works" className="text-neutral-600 hover:text-neutral-300 transition">
                    <ChevronDownIcon size={28} />
                </Link>
            </div>

            {/* How It Works Section */}
            <section id="how-it-works" className="min-h-screen flex items-center py-20">
                <div className="w-full fade-in">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
                        <p className="text-neutral-400 text-lg max-w-2xl mx-auto">BunkerCoin operates on shortwave radio signals, creating a truly decentralized layer 1 blockchain that functions without internet infrastructure.</p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-bunker/20 flex items-center justify-center">
                                        <RadioIcon className="w-6 h-6 text-bunker" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Radio Wave Propagation</h3>
                                    <p className="text-neutral-400">Nodes communicate via shortwave radio with a range of 2,500-5,000 miles. Just 10-20 nodes can achieve global coverage.</p>
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-bunker/20 flex items-center justify-center">
                                        <ZapIcon className="w-6 h-6 text-bunker" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Hybrid Architecture</h3>
                                    <p className="text-neutral-400">While nodes communicate via radio, optional internet gateways allow regular users to interact with the chain using standard devices.</p>
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-bunker/20 flex items-center justify-center">
                                        <ShieldIcon className="w-6 h-6 text-bunker" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">True Decentralization</h3>
                                    <p className="text-neutral-400">The pinnacle of decentralization—zero dependency on ISPs, cloud providers, or any centralized infrastructure. Your assets, truly yours.</p>
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-bunker/20 flex items-center justify-center">
                                        <NetworkIcon className="w-6 h-6 text-bunker" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Asset Bridge</h3>
                                    <p className="text-neutral-400">Bridge assets from Solana and other chains. Once on BunkerCoin, they're protected from any internet-based failure, and stay usable in the event of a catastrophe.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="relative">
                            <div className="aspect-square rounded-lg overflow-hidden">
                                <img src="/img/tower-blockchain.png" alt="Radio Tower Blockchain Visualization" className="w-full h-full object-cover" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Built for Crisis Section */}
            <section id="use-cases" className="min-h-screen flex items-center py-20">
                <div className="w-full fade-in">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">Built for Crisis</h2>
                        <p className="text-neutral-400 text-lg max-w-2xl mx-auto">When traditional infrastructure fails, BunkerCoin ensures your assets remain accessible—no matter the catastrophe.</p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition">
                            <img src="/img/icons/emp-icon-3d.png" alt="EMP Protection" className="size-16 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">EMP Attacks</h3>
                            <p className="text-neutral-400">Hardened radio equipment can survive electromagnetic pulses that would destroy internet infrastructure.</p>
                        </div>
                        
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition">
                            <img src="/img/icons/internet-blackout-icon-3d.png" alt="Internet Blackout Protection" className="size-16 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Internet Blackouts</h3>
                            <p className="text-neutral-400">Authoritarian shutdowns and censorship can't stop radio waves from crossing borders.</p>
                        </div>
                        
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition">
                            <img src="/img/icons/catastrophy-icon-3d.png" alt="Natural Disaster Protection" className="size-16 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Natural Disasters</h3>
                            <p className="text-neutral-400">When cell towers fall and cables break, shortwave radio continues to function.</p>
                        </div>
                    </div>
                    
                    <div className="mt-12 text-center">
                        <p className="text-lg text-neutral-300">The resilience layer for when resilience matters most.</p>
                    </div>
              </div>
            </section>

            {/* The Inception Section */}
            <section id="inception" className="py-20">
                <div className="w-full fade-in">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-6">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">The Inception</h2>
                            <p className="text-neutral-400 text-lg mb-4">
                                The concept of a blockchain operating on radio waves was originated by <span className="text-white">Anatoly Yakovenko</span>, Co-Founder of Solana. 
                                Since 2019, he's been sharing humorous thoughts about this idea, including a playful April Fools' 2024 technical abstract.
                            </p>
                            <p className="text-neutral-400 text-sm mb-4">
                                <Link href="https://x.com/search?q=from%3Aaeyakovenko%20(bunkercoin%20OR%20%22bunker%20coin%22%20OR%20radio%20OR%20%22cool%20if%20true%22)&src=typed_query&f=live" className="text-bunker hover:text-bunker/80 transition inline-flex items-center gap-1">
                                    View his posts here <ExternalLinkIcon className="w-3 h-3" />
                                </Link>
                                — a <i>very</i> entertaining read.
                            </p>
                        </div>
                        
                        {/* Toly's tweets graphic */}
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 mb-8">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {/* Tweet images */}
                                <div className="h-32 flex items-center justify-center">
                                    <img src="/img/toly/2019.png" alt="Toly's first tweet about radio blockchain (2019)" className="max-w-full max-h-full rounded-lg" />
                                </div>
                                <div className="h-32 flex items-center justify-center">
                                    <img src="/img/toly/2020.png" alt="Toly's tweet about radio blockchain (2020)" className="max-w-full max-h-full rounded-lg" />
                                </div>
                                <div className="h-32 flex items-center justify-center">
                                    <img src="/img/toly/2023.png" alt="Toly's tweet about radio blockchain (2023)" className="max-w-full max-h-full rounded-lg" />
                                </div>
                                <div className="h-32 flex items-center justify-center">
                                    <img src="/img/toly/abstract.png" alt="Technical Abstract April Fools 2024" className="max-w-full max-h-full rounded-lg" />
                                </div>
                                <div className="h-32 flex items-center justify-center">
                                    <img src="/img/toly/quote.png" alt="Toly quote repost about BunkerCoin" className="max-w-full max-h-full rounded-lg" />
                                </div>
                                <div className="h-32 flex items-center justify-center">
                                    <img src="/img/toly/wen-bls.png" alt="Wen BLS grinder tweet tagging BunkerCoin (2024)" className="max-w-full max-h-full rounded-lg" />
                                </div>
                            </div>
                            <p className="text-center text-sm text-neutral-500 mt-4">A few excerpts from X</p>
                        </div>
                        
                        <div className="text-center">
                            <p className="text-lg text-neutral-300">
                                Toly, we <span className="text-bunker">💚</span> you. And we'll turn the blockchain running on the ionosphere into reality!
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Open Building Section */}
            <section id="open-building" className="min-h-screen flex items-center py-20">
                <div className="w-full fade-in">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="order-2 md:order-1">
                            <div className="aspect-square rounded-lg overflow-hidden">
                                <img src="/img/community.png" alt="Open Source Community" className="w-full h-full object-cover" />
              </div>
              </div>
                        
                        <div className="order-1 md:order-2">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">Building in the Open</h2>
                            <p className="text-neutral-400 text-lg mb-8">
                                BunkerCoin is committed to transparency and open-source development. Our code, our progress, and our community decisions are all public.
                            </p>
                            
                            <div className="space-y-6">
                                <div className="flex items-start gap-3">
                                    <CodeIcon className="w-5 h-5 text-bunker mt-1" />
                                    <div>
                                        <h3 className="font-semibold mb-1">Open Source</h3>
                                        <p className="text-neutral-400 text-sm">All code is available on GitHub. Review, contribute, or fork.</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-start gap-3">
                                    <UsersIcon className="w-5 h-5 text-bunker mt-1" />
                                    <div>
                                        <h3 className="font-semibold mb-1">Community-Driven Future</h3>
                                        <p className="text-neutral-400 text-sm">Building towards decentralized governance where the community shapes our direction.</p>
                                    </div>
              </div>

                                <div className="flex items-start gap-3">
                                    <ShieldCheckIcon className="w-5 h-5 text-bunker mt-1" />
                                    <div>
                                        <h3 className="font-semibold mb-1">Open Science</h3>
                                        <p className="text-neutral-400 text-sm">Writing our technical papers in public, sharing research as it develops.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <NetworkIcon className="w-5 h-5 text-bunker mt-1" />
                                    <div>
                                        <h3 className="font-semibold mb-1">Transparent Progress</h3>
                                        <p className="text-neutral-400 text-sm">Live explorer, public roadmap, and regular community updates.</p>
                                    </div>
                                </div>
              </div>

                            <div className="mt-8">
                                <Link href="https://github.com/TheBunkerCoin" className="inline-flex items-center gap-2 text-bunker hover:text-bunker/80 transition">
                                    View on GitHub <ExternalLinkIcon className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Physical Safe Haven Network Section - hidden */}
            {false && <section id="safe-havens" className="min-h-screen flex items-center py-20">
                <div className="w-full fade-in">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">Physical Safe Haven Network</h2>
                        <p className="text-neutral-400 text-lg max-w-2xl mx-auto">Beyond digital resilience, we're building real-world sanctuaries for times of crisis—and we already own the world's largest bunker.</p>
              </div>
                    
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h3 className="text-2xl font-semibold mb-4 flex items-center gap-3">
                                <BuildingIcon className="w-8 h-8 text-bunker" />
                                The World's Largest Bunker - We Own It
                            </h3>
                            <p className="text-neutral-400 mb-6">
                                Our flagship facility covers 70,000 m² (750,000 sqft) of underground space in Halberstadt, Germany. Originally built during WWII and modernized during the Cold War to withstand nuclear attacks, this historic fortress is now fully owned by BunkerCoin.
                            </p>
                            
                            <div className="space-y-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-bunker rounded-full"></div>
                                    <p className="text-sm">Atomic-safe construction</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-bunker rounded-full"></div>
                                    <p className="text-sm">Self-sufficient infrastructure</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-bunker rounded-full"></div>
                                    <p className="text-sm">NFT-based access rights</p>
                                </div>
              </div>
                            
                            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-6">
                                <p className="text-sm text-neutral-400 mb-3">Ownership verified via German Land Registry & Trade Register</p>
                                <div className="flex gap-3 text-xs">
                                    <Link href="/view?file=land-registry" target="_blank" className="text-neutral-500 hover:text-neutral-300 transition" rel="noopener noreferrer">
                                        View Land Registry
                                    </Link>
                                    <span className="text-neutral-700">•</span>
                                    <Link href="/view?file=trade-register" target="_blank" className="text-neutral-500 hover:text-neutral-300 transition" rel="noopener noreferrer">
                                        View Trade Register
                                    </Link>
              </div>
              </div>

                            <div className="flex gap-3 flex-wrap">
                                <Link href="/our-bunker" className="inline-flex items-center gap-2 px-6 py-3 bg-bunker hover:bg-bunker/80 text-black font-semibold rounded-md transition">
                                    Learn More About Our Bunker
                                    <ExternalLinkIcon className="w-4 h-4" />
                                </Link>
                                <Link href="https://maps.apple.com/frame?map=satellite&center=51.85485670349599%2C11.03182336938059&span=0.021933893766671986%2C0.06143946175734527&q=BunkerCoin%20Bunker&t=h" className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-md transition">
                                    <MapPinIcon className="w-4 h-4" />
                                    View on Maps
                                </Link>
                            </div>
                        </div>
                        
                        <div className="relative">
                            <MediaPlayer
                                src="https://assets.bunkercoin.com/media/video/bunker-trailer.mp4"
                                viewType="video"
                                logLevel="warn"
                        
                                playsInline
                                title="BunkerCoin Bunker Trailer"
                            >
                                <MediaProvider>
                                    <Poster className="vds-poster" />
                                </MediaProvider>
                                <DefaultVideoLayout
                                    thumbnails="https://assets.bunkercoin.com/media/video/bunker-trailer-thumbnails.vtt"
                                    icons={defaultLayoutIcons}
                                />
                            </MediaPlayer>
                        </div>
                    </div>
                </div>
            </section>}

            {/* Roadmap Section - hidden */}
            {false && <section id="roadmap" className="min-h-screen flex items-center py-20">
                <div className="w-full fade-in">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">Roadmap to Testnet</h2>
                        <p className="text-neutral-400 text-lg max-w-2xl mx-auto">Building the future of resilient infrastructure, one milestone at a time.</p>
                    </div>
                    
                    <div className="max-w-3xl mx-auto">
                        <div className="space-y-4">
                            {/* Completed */}
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <div className="w-6 h-6 rounded-full bg-bunker flex items-center justify-center">
                                        <CheckIcon className="w-4 h-4 text-black" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Simulated Radio Network Prototype</h3>
                                    <p className="text-sm text-neutral-400">Successfully deployed and running at explorer.bunkercoin.io</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <div className="w-6 h-6 rounded-full bg-bunker flex items-center justify-center">
                                        <CheckIcon className="w-4 h-4 text-black" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Alpenglow Consensus Adaptation</h3>
                                    <p className="text-sm text-neutral-400">Adapted Solana's next-gen consensus for radio wave propagation</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <div className="w-6 h-6 rounded-full bg-bunker flex items-center justify-center">
                                        <CheckIcon className="w-4 h-4 text-black" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Node State Persistence</h3>
                                    <p className="text-sm text-neutral-400">Implemented durable state management for network reliability</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <div className="w-6 h-6 rounded-full bg-bunker flex items-center justify-center">
                                        <CheckIcon className="w-4 h-4 text-black" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Open Source Contributors Assembled</h3>
                                    <p className="text-sm text-neutral-400">Growing community of talented developers contributing to the vision</p>
                                </div>
                            </div>
                            
                            {/* In Progress */}
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <LoaderIcon className="w-6 h-6 text-bunker animate-spin" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Node Network Decentralization</h3>
                                    <p className="text-sm text-neutral-400">Enabling community-run nodes for true decentralization</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <LoaderIcon className="w-6 h-6 text-bunker animate-spin" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Transaction API & Wallet Integration</h3>
                                    <p className="text-sm text-neutral-400">Building user-friendly interfaces for seamless interactions</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <LoaderIcon className="w-6 h-6 text-bunker animate-spin" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Technical Paper v1</h3>
                                    <p className="text-sm text-neutral-400">Comprehensive documentation of the radio-wave blockchain architecture</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <div className="w-6 h-6 rounded-full border-2 border-neutral-600"></div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Physical Radio Prototype</h3>
                                    <p className="text-sm text-neutral-400">Ionosphere-bouncing shortwave radio hardware development</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <div className="w-6 h-6 rounded-full border-2 border-neutral-600"></div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Performance Optimizations</h3>
                                    <p className="text-sm text-neutral-400">BLS signature aggregation, transaction grinding, and more</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <div className="w-6 h-6 rounded-full border-2 border-neutral-600"></div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Solana Bridge Foundation</h3>
                                    <p className="text-sm text-neutral-400">Initial bridge infrastructure for asset transfers</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    <div className="w-6 h-6 rounded-full border-2 border-neutral-600"></div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold mb-1">Physical Testnet Launch</h3>
                                    <p className="text-sm text-neutral-400">Real radio nodes communicating across continents</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-12 text-center">
                            <p className="text-neutral-500 text-sm">...and much more beyond testnet</p>
                        </div>
                    </div>
                </div>
            </section>}

            {/* Join the Network Section */}
            <section id="join" className="min-h-screen flex items-center py-20">
                <div className="w-full fade-in">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4">Join the Network</h2>
                        <p className="text-neutral-400 text-lg max-w-2xl mx-auto">Multiple ways to participate in building humanity's resilience layer.</p>
              </div>
                    
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-bunker/20 flex items-center justify-center mx-auto mb-4">
                                <RadioIcon className="w-10 h-10 text-bunker" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Run a Node</h3>
                            <p className="text-neutral-400 mb-4">Operate radio hardware to strengthen the network and earn rewards.</p>
                            <span className="text-neutral-500 text-sm">
                                Coming Soon
                            </span>
              </div>
                        
                        <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-bunker/20 flex items-center justify-center mx-auto mb-4">
                                <CodeIcon className="w-10 h-10 text-bunker" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Contribute</h3>
                            <p className="text-neutral-400 mb-4">Join our Discord to connect with contributors. Raise issues and open PRs on GitHub!</p>
                            <div className="flex flex-col gap-2 items-center">
                                <Link href="https://discord.gg/DGBqm92VQm" className="text-bunker hover:text-bunker/80 transition">
                                    Join Discord →
                                </Link>
                                <Link href="https://github.com/TheBunkerCoin" className="text-bunker hover:text-bunker/80 transition text-sm">
                                    View GitHub →
                                </Link>
                            </div>
              </div>

                        <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-bunker/20 flex items-center justify-center mx-auto mb-4">
                                <UsersIcon className="w-10 h-10 text-bunker" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Join the Community</h3>
                            <p className="text-neutral-400 mb-4">Participate in governance and help shape the future of resilience.</p>
                            <Link href="https://t.me/bunkercoin_io" className="text-bunker hover:text-bunker/80 transition">
                                Join Telegram →
                            </Link>
                        </div>
              </div>
          </div>
            </section>

            {/* Built on Solana */}
            <div className="flex justify-center py-16">
                <img 
                    src="/img/built-on-solana.png" 
                    alt="Built on Solana" 
                    className="w-64 opacity-70 hover:opacity-100 transition-opacity"
                />
            </div>

            <Footer />
          </main>
      </>
  );
}
