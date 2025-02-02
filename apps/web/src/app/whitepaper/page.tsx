import React from 'react';
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {ArrowLeft} from "lucide-react";

const WhitePaper = () => {
    return (
        <>
            <div className="fixed top-4 left-4 z-50">
                <Link href="/">
                    <Button  className="">
                        <ArrowLeft className="mr-0 md:mr-2 h-4 w-4"/> <span className={"hidden md:flex"}>Back to Home</span>
                    </Button>
                </Link>
            </div>

            <iframe
                src="https://gamma.app/embed/k2y90w3ne3rilxy"
                className="w-screen h-screen border-0"
                title="BunkerCoin Whitepaper"
            />
            </>
            );
            };

            export default WhitePaper;