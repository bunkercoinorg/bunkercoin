import React from 'react';

interface PDFViewerProps {
    pdfUrl: string;
    title?: string;
    className?: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
                                                 pdfUrl,
                                                 title = 'PDF Viewer',
                                                 className = ''
                                             }) => {
    const encodedUrl = encodeURIComponent(pdfUrl);
    const viewerUrl = `https://docs.google.com/viewerng/viewer?url=${encodedUrl}&embedded=true`;

    return (
        <div className={`w-full h-screen flex flex-col ${className}`}>
            <header className="bg-neutral-900 p-4 shadow-lg">
                <h1 className="text-neutral-100 text-lg font-medium">{title}</h1>
            </header>

            <main className="flex-1 relative w-full bg-neutral-800">
                <iframe
                    src={viewerUrl}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    title={title}
                />
            </main>
        </div>
    );
};

export default PDFViewer;