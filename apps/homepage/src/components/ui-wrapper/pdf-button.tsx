import React from 'react';
import { FileText } from 'lucide-react';

interface PDFButtonProps {
    title: string;
    fileSize: string;
    link: string;
    className?: string;
}

const PDFButton: React.FC<PDFButtonProps> = ({
                                                 title,
                                                 fileSize,
                                                 link,
                                                 className = '',
                                             }) => {
    return (
        <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`
        flex items-start gap-3 p-3 
        rounded-lg transition-colors duration-200
        bg-neutral-800 hover:bg-neutral-700
        dark:bg-neutral-900 dark:hover:bg-neutral-800
        text-left w-full
        ${className}
      `}
        >
            <div className="flex-shrink-0 mt-1">
                <FileText className="w-5 h-5 text-neutral-400"/>
            </div>

            <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-white dark:text-neutral-200 truncate">
          {title}
        </span>
                <span className="text-xs text-neutral-400 mt-0.5">
          {fileSize}
        </span>
            </div>
        </a>
    );

};

export default PDFButton;