"use client"

import Footer from "@/components/sections/footer";
import LayeredIcon from "@/components/ui-wrapper/layered-icon";
import {
    BadgeInfoIcon,
    ChartNoAxesGanttIcon, DollarSignIcon,
    ExternalLinkIcon, FileTextIcon, ImagesIcon, MessageCircleQuestionIcon, NewspaperIcon,
    ShieldCheckIcon,
    SparklesIcon,
    WrenchIcon
} from "lucide-react";
import Roadmap from "@/components/sections/roadmap";
import LandingGallerySlideshow from "@/components/sections/gallery-slideshow";
import {SiTelegram, SiX} from "@icons-pack/react-simple-icons";
import Link from "next/link";
import FAQ from "@/components/sections/faq";
import HowToBuy from "@/components/sections/how-to-buy";
import BuyNowButton from "@/components/ui-wrapper/buy-now-button";
import PDFButton from "@/components/ui-wrapper/pdf-button";
import MediumFeed from "@/components/sections/medium-feed";
import Header from "@/components/sections/header";

export default function Home() {
  const tokenCA = "8NCievmJCg2d9Vc2TWgz2HkE6ANeSX7kwvdq5AL7pump"

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

          <div className={"flex flex-col items-center justify-center mt-[20vh] *:max-w-[90vw] *:md:max-w-[35vw]"}>
              <h2 className={"text-4xl font-semibold"}>BunkerCoin</h2>
              <h2 className={"text-xl mt-4 text-neutral-500 text-center"}>The biggest private bunker in the world. Now
                  on Solana.</h2>
              <div className={"flex justify-around gap-x-6 mb-8 mt-6"}>
                  <Link href={"https://x.com/bunkercoin_io"}><SiX className={"size-8"}></SiX></Link>
                  <Link href={"https://t.me/bunkercoin_io"}><SiTelegram
                      className={"size-8"}></SiTelegram></Link>
              </div>
              <h1 className={"text-7xl font-bold font-mona-extended primary-heading mb-8"}>$BUNKER</h1>
              <div className={"flex items-center gap-x-4 mt-6 mb-10"}>
                  <BuyNowButton/>
                  <a className={"group flex items-center gap-x-2 px-4 py-2 rounded-md bg-neutral-800/50 backdrop-blur-md border border-neutral-700 text-white hover:border-neutral-600 transition-all duration-300"}
                     href={"/whitepaper"}>Whitepaper<FileTextIcon
                      className={"text-neutral-600 size-5 stroke-1 group-hover:text-neutral-500 transition-all duration-300"}
                  /></a>
              </div>
              <div
                  className={"text-xl gap-x-2 bg-neutral-900 px-4 py-2 rounded-md flex border-neutral-800/60 backdrop-blur-md items-center border hover:border-neutral-700 transition-all duration-300 group mb-4"}>
                  <span>CA:</span>
                  <a className={"hidden lg:flex"} href={`https://solscan.io/account/${tokenCA}`}
                     target={"_blank"}>{tokenCA}</a>
                  <a className={"flex lg:hidden"} href={`https://solscan.io/account/${tokenCA}`}
                     target={"_blank"}>{`${tokenCA.slice(0, 5)}...${tokenCA.slice(-5)}`}</a>
                  <ExternalLinkIcon
                      className={"text-neutral-700 size-5 stroke-1 group-hover:text-neutral-500 transition-all duration-300"}
                  />
              </div>
              <div className={"flex items-center  w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={BadgeInfoIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>About the Bunker</h5>
              </div>
              <p className={"mt-2"}>
                  The bunker, originally called &quot;Project Malachite,&quot; is a massive underground
                  facility covering approximately 70,000 m² (750,000 sqft), built during World War II. Initially
                  planned as the world&apos;s largest jet engine factory, it was secretly modernized by
                  East German military leaders during the Cold War to withstand nuclear attacks.
                  Beyond its historical significance, the bunker gained fame for housing the
                  entire cash reserves of East Germany after reunification and serving as a
                  filming location for movies like <span className={"italic"}>Monuments Men</span> with George Clooney
                  and
                  the
                  recent <span className={"italic"}>Zwei zu Eins</span>.
              </p>
              <div className={"flex items-center  w-full justify-start gap-x-6 mt-8"} id={"blog"}>
                  <LayeredIcon Icon={SparklesIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Our Vision:<span className={"font-normal"}>&nbsp;Creating Safe Havens in Times of Crisis</span>
                  </h5>
              </div>
              <p className={"mt-2"}>
                  Bunkercoin envisions a world where secure sanctuaries exist for people
                  during times of uncertainty and crisis. Our inaugural project centers on our
                  historic bunker in Halberstadt, that serves as the foundation of this vision.
                  In the future we&apos;ll expand towards realizing further safe heaven projects around the globe.
              </p>

              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"} id={"utility"}>
                  <LayeredIcon Icon={WrenchIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Utility
                  </h5>
              </div>

              <div className={"mt-2"}>
                  <ul className="list-disc pl-4">
                      <li>
                          <span className={"font-bold"}>NFT Benefits:</span> Personal bunker space
                          for emergencies, storage, etc. with tradable/subleasable rights (payments in BunkerCoin)
                      </li>
                      <li><span className={"font-bold"}>Participatory Governance:</span> Direct input in shaping the
                          bunker’s
                          renovation, operation and future safe-haven projects.
                      </li>
                      <li>
                          <span className={"font-bold"}>Token Mechanics:</span> Sustainable staking rewards, deflation and liquidity
                          through buyback-and-burn and buyback-and-lock mechanisms, fueled by project revenue
                      </li>
                      <li>
                          <span className={"font-bold"}>Exclusive Access:</span> Guided tours of the Halberstadt bunker,
                          priority entry to events, venues and influencer live streams.
                      </li>
                      <li><span className={"font-bold"}>Personalization Services:</span> Payment for outfitting and
                          equipping your
                          personal bunker space.
                      </li>
                  </ul>
                  <p className={"mt-4"}>
                      The restoration of the Halberstadt bunker is a community-driven effort, funded through NFT sales and a dedicated 15% renovation allocation from BunkerCoin.
                      This dual approach ensures both immediate progress and long-term sustainability.<br /><br />
                      The bunker, with its deep historical significance, will be modernized to serve as both a secure refuge and a multifunctional space for events, exhibitions, and future innovations.
                      <br />BunkerCoin and NFT holders directly contribute to preserving this unique site while securing a designated space for emergencies.
                      As renovations progress, the facility will also serve as a hub for research, technology, and industry collaboration.
                      <br />Together, we are transforming this historic structure into a forward-thinking stronghold—bridging the past with a resilient future while laying the foundation for a global network of secure locations.
                      <br /><br />This is just the beginning—BunkerCoin is laying the groundwork for a future
                      where safety and community thrive, no matter the circumstances.
                  </p>
              </div>

              <div className={"flex items-center  w-full justify-start gap-x-6 mt-8 mb-6"}>
                  <LayeredIcon Icon={NewspaperIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Latest Blog Posts
                  </h5>
              </div>
              <MediumFeed></MediumFeed>

              <div className={"flex items-center w-full justify-start gap-x-6 mt-2"}>
                  <LayeredIcon Icon={ChartNoAxesGanttIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Roadmap
                  </h5>
              </div>
              <Roadmap></Roadmap>

              <div className={"flex items-center w-full justify-start gap-x-6 mt-8"} id={"proof"}>
                  <LayeredIcon Icon={ShieldCheckIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Yes, we <span className={"italic"}>actually</span> own the bunker
                  </h5>
              </div>
              <div className={"bg-neutral-900 w-full flex flex-col gap-y-4 mt-6 rounded-md p-4"}>
                  <span className={"text-neutral-400"}><span
                      className={"text-white"}>Below linked are two documents:</span><br/>1. The Grundbuch (Land Registry) for the Bunker, which is the German state-determined source of truth when it comes to who owns which property.<br/>2. The Trade Register, showing the company that is written in the Land Register being owned by Peter Jugl, our project founder.</span>
                  <PDFButton title={"Land Registry"} fileSize={"7.1 MB"} link={"/view?file=land-registry"}/>
                  <PDFButton title={"Trade Register"} fileSize={"31.7 kb"} link={"/view?file=trade-register"}/>
                  <span className={"text-sm text-neutral-400"}>For those not wanting to dig through, we&apos;ll also get an audit from a major crypto auditor to additionally undermine above.</span>
              </div>


              <div className={"flex items-center  w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={ImagesIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      Gallery:<span className={"font-normal"}>&nbsp;A few impressions of the bunker</span>
                  </h5>
              </div>
              <LandingGallerySlideshow/>
              <p className={"mt-2 text-neutral-700"}><span><b>Transparency Note:</b></span> The pictures show the bunker
                  in the original historic shape, which has partially degraded due to vandalism before our ownership of
                  the bunker. Our aim is to restore, overcome and upgrade the original way the facility was designed -
                  together with you, the community.</p>

              <div className={"flex items-center  w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={DollarSignIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      How to Buy
                  </h5>
              </div>
              <HowToBuy></HowToBuy>

              <div className={"flex items-center  w-full justify-start gap-x-6 mt-8"}>
                  <LayeredIcon Icon={MessageCircleQuestionIcon}></LayeredIcon>
                  <h5 className={"text-xl font-semibold"}>
                      FAQs
                  </h5>
              </div>

              <div className={"mt-2 flex flex-col"}>
                  <FAQ/>
              </div>
              <img className={"w-64 mt-9"} src={"/img/built-on-solana.png"}/>
              <Footer></Footer>
          </div>
      </>
  );
}
