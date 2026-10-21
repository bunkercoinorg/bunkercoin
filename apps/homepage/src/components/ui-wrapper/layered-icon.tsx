import React from 'react';
import {SparklesIcon} from 'lucide-react';

const LayeredIcon = ({ Icon = SparklesIcon }) => {
    return (
        <div className="relative size-[24px] flex items-center justify-center">
            {/* Large icon with low opacity in the background */}
            <div className="absolute">
                <Icon
                    size={48}
                    className="text-white opacity-[7.5%] font-bold stroke-[3px]"
                />
            </div>

            {/* Small icon with full opacity in the foreground */}
            <div className="absolute">
                <Icon
                    size={24}
                    className="text-white stroke-2"
                />
            </div>
        </div>
    );
};

export default LayeredIcon;