"use client"

import React from 'react';
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {ArrowLeft, AlertTriangle} from "lucide-react";
import PDFViewer from "@/components/sections/pdf-viewer"
import {  Suspense } from "react"

interface PDFFile {
    url: string
    title: string
}

const selectedPDF: PDFFile = {
    url: 'https://assets.bunkercoin.com/docs/whitepaper-1.0.pdf',
    title: 'BunkerCoin Whitepaper'
}

const PDFViewContent = () => {
    if (!selectedPDF) {
        return (
            <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-neutral-800 rounded-lg p-6 text-center">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h1 className="text-xl font-medium text-neutral-100 mb-2">
                        Invalid Document Request
                    </h1>
                    <p className="text-neutral-400 mb-4">
                        No document available.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="fixed top-4 left-4 z-50">
                <Link href="/">
                    <Button className="">
                        <ArrowLeft className="mr-0 md:mr-2 h-4 w-4"/> <span className={"hidden md:flex"}>Back to Home</span>
                    </Button>
                </Link>
            </div>
            <PDFViewer pdfUrl={selectedPDF.url} title={selectedPDF.title} />
        </>
    )
}

const LoadingState = () => (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-neutral-100">Loading...</div>
    </div>
)

const PDFViewPage = () => {
    return (
        <Suspense fallback={<LoadingState />}>
            <PDFViewContent />
        </Suspense>
    )
}

export default PDFViewPage

/*
const WhitePaper = () => {
    return (
        <>
            <div className="fixed top-4 left-4 z-50">
                <Link href="/">
                    <Button className="">
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
*/