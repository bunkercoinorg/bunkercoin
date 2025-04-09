import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import Footer from "@/components/sections/footer";

const Imprint = () => {
    return (
        <>
        <main className="w-full min-h-screen text-white flex flex-col items-center justify-center">

                <div className="absolute top-4 left-4 z-50">
                    <Link href="/">
                        <Button variant="ghost" className="">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                        </Button>
                    </Link>
                </div>

                <h1 className="text-5xl font-bold mt-12 md:mt-6 mb-6">
                    Imprint
                </h1>

                <div className="mb-24 z-20 flex flex-col gap-y-6 border border-neutral-800 rounded-lg w-[90vw] md:w-[60vw] p-8 md:p-12 backdrop-blur-sm">
                    <h2 className="text-2xl font-semibold text-white">Contact Information</h2>
                    <div className={"flex flex-col gap-y-0.5"}>
                       <span className={"mb-2"}>MINING PROJECT MANAGEMENT COMPANY LIMITED</span>
                    <span><b>Address</b></span>
                    <span>21 Kotu South, Kotu</span>
                    <span>Kanifing Municipal Council (KMC)</span>
                    <span>Serrekunda, The Gambia</span>
                        { /* <span className={"mb-2"}>Bilin GmbH</span>
                    <span><b>Address</b></span>
                    <span>Prödeler Str. 9</span>
                    <span>04416, Markkleeberg</span>
                    <span>Germany</span> */}
                    </div>
                    <div className={"flex flex-col gap-y-0.5"}>
                    <span><b>E-Mail</b></span>
                    <a href="mailto:contact@bunkercoin.io" className="hover:underline">contact@bunkercoin.io</a>
                    </div>
                    <h2 className="text-2xl font-semibold mt-6">Legal Disclaimer</h2>
                    <p>
                        The information provided on this website is for general informational purposes only. While we strive to keep the information up to date and correct, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability or availability with respect to the website or the information, products, services, or related graphics contained on the website for any purpose.
                    </p>
                </div>
        </main>
        <Footer />
        </>
    );
};

export default Imprint;