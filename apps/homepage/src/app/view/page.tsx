"use client"

import { AlertTriangle } from "lucide-react"
import PDFViewer from "@/components/sections/pdf-viewer"
import { useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"

interface PDFFile {
    url: string
    title: string
}

const pdfFiles: Record<string, PDFFile> = {
    'land-registry': {
        url: '/docs/land-registry.pdf',
        title: 'Land-Registry'
    },
    'trade-register': {
        url: '/docs/trade-register.pdf',
        title: 'Trade Register'
    },
    'technical-whitepaper': {
        url: 'https://raw.githubusercontent.com/TheBunkerCoin/bunker_coin/docs/whitepaper/bunker_coin.pdf',
        title: 'BunkerCoin Technical Whitepaper'
    },
}

const PDFViewContent = () => {
    const searchParams = useSearchParams()
    const [selectedPDF, setSelectedPDF] = useState<PDFFile | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fileParam = searchParams.get('file')
        
        // Check if it's a predefined file
        if (fileParam && pdfFiles[fileParam]) {
            setSelectedPDF(pdfFiles[fileParam])
        } 
        // Handle direct URL for backward compatibility
        else if (fileParam && fileParam.startsWith('http')) {
            setSelectedPDF({
                url: fileParam,
                title: 'Document Viewer'
            })
        }
       
        // Set loading to false after checking
        setIsLoading(false)
    }, [searchParams])

    if (isLoading) {
        return <LoadingState />
    }

    if (!selectedPDF) {
        return (
            <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-neutral-800 rounded-lg p-6 text-center">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h1 className="text-xl font-medium text-neutral-100 mb-2">
                        Invalid Document Request
                    </h1>
                    <p className="text-neutral-400 mb-4">
                        Please specify a valid document type using the &apos;file&apos; parameter:
                    </p>
                    <div className="space-y-2 text-neutral-300">
                        <code className="block bg-neutral-700 p-2 rounded">
                            ?file=land-registry
                        </code>
                        <code className="block bg-neutral-700 p-2 rounded">
                            ?file=trade-register
                        </code>
                        <code className="block bg-neutral-700 p-2 rounded">
                            ?file=technical-whitepaper
                        </code>
                    </div>
                </div>
            </div>
        )
    }

    return <PDFViewer pdfUrl={selectedPDF.url} title={selectedPDF.title} />
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