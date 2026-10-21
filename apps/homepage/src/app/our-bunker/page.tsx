"use client"

import { notFound } from "next/navigation";

export default function OurBunkerDisabled() {
    notFound();
}

// page disabled - original code kept below for future re-enable

import Footer from "@/components/sections/footer";
import LayeredIcon from "@/components/ui-wrapper/layered-icon";
import {
    BadgeInfoIcon,
    ChartNoAxesGanttIcon,
    ExternalLinkIcon,
    FileTextIcon,
    ImagesIcon,
    MessageCircleQuestionIcon,
    ShieldCheckIcon,
    SparklesIcon,
    WrenchIcon,
    BuildingIcon,
    MapPinIcon,
    HistoryIcon
} from "lucide-react";
import LandingGallerySlideshow from "@/components/sections/gallery-slideshow";
import Link from "next/link";
import PDFButton from "@/components/ui-wrapper/pdf-button";
import Header from "@/components/sections/header";
import {useEffect} from "react";
import {initX, trackXConversionOnce} from "@/components/util/x";

function Malachite() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            initX();
            document.documentElement.style.scrollBehavior = 'smooth';
        }
    }, []);

  return (
      <>
          <Header></Header>
          <div className="absolute top-0 -z-10 h-screen w-full">
              {/* Background image container */}
              <div
                  className="h-full w-full opacity-[14%]"
                  style={{
                      backgroundImage: 'url("/img/bg-1.jpg")',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                  }}
              />
              {/* Gradient overlay */}
              <div className="absolute bottom-0 h-[15%] w-full bg-gradient-to-t from-neutral-950 to-transparent"/>
          </div>

          <div className={"flex flex-col items-center justify-center mt-[20vh] px-4 md:px-0 *:max-w-[90vw] *:md:max-w-[45vw]"}>
              <Link href="/" className="text-neutral-500 hover:text-neutral-300 transition mb-6 text-sm">← Back to Home</Link>
              
              <h1 className={"text-5xl md:text-6xl font-bold text-center mb-4"}>Our Bunker</h1>
              <h2 className={"text-xl mt-4 text-neutral-400 text-center mb-12"}>The World's Largest Private Bunker - Owned by BunkerCoin</h2>
              
              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={BuildingIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>About the Facility</h5>
              </div>
              <p className={"mt-2 text-neutral-300"}>
                  Our bunker is a massive underground facility covering approximately 70,000 m² (750,000 sqft), 
                  built during World War II. Initially planned as an underground factory, it was later 
                  modernized by East German military leaders during the Cold War to withstand nuclear attacks. 
                  Today, it stands as a testament to engineering and resilience - and it's ours.
              </p>
              
              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={HistoryIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>Historical Significance</h5>
              </div>
              <p className={"mt-2 text-neutral-300"}>
                  Beyond its military history, the bunker gained international fame for housing the
                  entire cash reserves of East Germany after reunification - billions of Deutsche Marks stored in its secure vaults. 
                  The facility has also served as a filming location for major Hollywood productions including 
                  <span className={"italic"}> Monuments Men</span> with George Clooney and the recent German film 
                  <span className={"italic"}> Zwei zu Eins</span>.
              </p>

              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={MapPinIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>Strategic Location</h5>
              </div>
              <p className={"mt-2 text-neutral-300"}>
                  Located near Halberstadt in central Germany, the bunker sits at the heart of Europe, 
                  providing strategic access to major population centers. The facility includes not just 
                  the underground complex but also 10,700,000 sqft of land above ground, offering 
                  extensive development possibilities for future safe haven infrastructure.
              </p>

              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={SparklesIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Our Vision
                  </h5>
              </div>
              <div className="mt-2">
                  <p className="text-neutral-300">
                      We are transforming this historic fortress into a modern resilience hub. The renovation 
                      combines preservation of its unique Cold War architecture with cutting-edge technology 
                      to create the ultimate safe haven. This includes:
                  </p>
                  <ul className="list-disc pl-6 mt-4 space-y-2 text-neutral-300">
                      <li>Self-sufficient power generation and water systems</li>
                      <li>Advanced air filtration capable of handling nuclear, biological, and chemical threats</li>
                      <li>Hardened communication infrastructure including radio nodes for BunkerCoin</li>
                      <li>Living quarters, medical facilities, and community spaces</li>
                      <li>Secure storage for both physical and digital assets</li>
                  </ul>
              </div>

              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={WrenchIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      NFT-Based Access Rights
                  </h5>
              </div>
              <div className={"mt-2"}>
                  <p className="text-neutral-300 mb-4">
                      Access to our bunker will be managed through Bunker NFTs, initially issued on the Solana blockchain and later bridgeable to BunkerCoin:
                  </p>
                  <ul className="list-disc pl-6 space-y-2 text-neutral-300">
                      <li>
                          <span className={"font-bold"}>Access Rights:</span> Secure your designated access to the bunker facility
                      </li>
                      <li>
                          <span className={"font-bold"}>Tradeable Assets:</span> NFTs can be sold, leased, or inherited
                      </li>
                      <li>
                          <span className={"font-bold"}>Enhanced Governance:</span> NFT holders receive additional voting power on facility decisions, complementing their $BUNKER token voting rights
                      </li>
                      <li>
                          <span className={"font-bold"}>Revenue Distribution:</span> Facility revenues flow back to the $BUNKER token ecosystem
                      </li>
                  </ul>
              </div>

              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"} id={"proof"}>
                  <LayeredIcon Icon={ShieldCheckIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Verified Ownership
                  </h5>
              </div>
              <div className={"bg-neutral-900 w-full flex flex-col gap-y-4 mt-6 rounded-md p-4"}>
                  <span className={"text-neutral-400"}><span
                      className={"text-white"}>Legal documentation proving our ownership:</span><br/>
                      1. The Grundbuch (Land Registry) - German state registry confirming property ownership<br/>
                      2. The Trade Register - Showing company ownership by project founder Peter Jugl</span>
                  <PDFButton title={"Land Registry"} fileSize={"7.1 MB"} link={"/view?file=land-registry"}/>
                  <PDFButton title={"Trade Register"} fileSize={"31.7 kb"} link={"/view?file=trade-register"}/>
                  <span className={"text-sm text-neutral-400"}>Third-party audit from major crypto auditor coming soon.</span>
              </div>

              {/* Layout Plan Subsection */}
              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={ImagesIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Layout Plan
                  </h5>
              </div>
              <div className="mt-4 w-full">
                  <img src="/img/bunker-layout-plan.png" alt="Bunker layout plan" className="w-full rounded-lg border border-neutral-800" />
              </div>

              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={ChartNoAxesGanttIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Renovation Roadmap
                  </h5>
              </div>
              <div className="mt-4 space-y-4">
                  <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                      <h6 className="font-semibold text-bunker mb-2">Phase 1: Infrastructure (In Progress)</h6>
                      <p className="text-sm text-neutral-400">Electrical systems, emergency generators, LED lighting, basic security</p>
                  </div>
                  <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                      <h6 className="font-semibold text-neutral-300 mb-2">Phase 2: Blast Doors & Security</h6>
                      <p className="text-sm text-neutral-400">Restoration of nuclear-grade blast doors and modern access control</p>
                  </div>
                  <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                      <h6 className="font-semibold text-neutral-300 mb-2">Phase 3: Life Support Systems</h6>
                      <p className="text-sm text-neutral-400">Air filtration, water purification, waste management</p>
                  </div>
                  <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
                      <h6 className="font-semibold text-neutral-300 mb-2">Phase 4: Living Spaces</h6>
                      <p className="text-sm text-neutral-400">Private quarters, common areas, medical facilities</p>
                  </div>
              </div>

              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={ImagesIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Gallery
                  </h5>
              </div>
              <LandingGallerySlideshow/>
              <p className={"mt-2 text-neutral-600 text-sm"}>
                  <span><b>Note:</b></span> Some images show the bunker's original state. Vandalism occurred before our ownership. 
                  Our renovation will restore and upgrade the facility beyond its original specifications.
              </p>

              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={MessageCircleQuestionIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Frequently Asked Questions
                  </h5>
              </div>
              <div className="mt-4 space-y-6">
                  <div>
                      <h6 className="font-semibold mb-2">Can I visit the bunker?</h6>
                      <p className="text-neutral-400 text-sm">Exclusive tours are available for BunkerCoin and future NFT holders. Register interest through our Telegram community.</p>
                  </div>
                  <div>
                      <h6 className="font-semibold mb-2">When will NFTs be available?</h6>
                      <p className="text-neutral-400 text-sm">Founder Edition NFTs are planned for Q4 2025. Priority will be given to early BunkerCoin holders.</p>
                  </div>
                  <div>
                      <h6 className="font-semibold mb-2">How is renovation funded?</h6>
                      <p className="text-neutral-400 text-sm">Through 15% of BunkerCoin supply allocation plus NFT sales. All funds are transparently tracked on-chain.</p>
                  </div>
                  <div>
                      <h6 className="font-semibold mb-2">What about the treasure rumors?</h6>
                      <p className="text-neutral-400 text-sm">Yes, you're welcome to search for hidden GDR money or the Amber Room during your visits!</p>
                  </div>
              </div>

              <div className="mt-16 flex gap-4 justify-center flex-wrap">
                  <Link href="/" className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-md transition">
                      Back to Home
                  </Link>
                  <Link href="https://maps.apple.com/frame?map=satellite&center=51.85485670349599%2C11.03182336938059&span=0.021933893766671986%2C0.06143946175734527" className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-md transition flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4" />
                      View on Apple Maps
                  </Link>
                  <Link href="https://t.me/bunkercoin_io" className="px-6 py-3 bg-bunker hover:bg-bunker/80 text-black font-semibold rounded-md transition">
                      Join Community
                  </Link>
              </div>

              <Footer></Footer>
          </div>
      </>
  );
}
