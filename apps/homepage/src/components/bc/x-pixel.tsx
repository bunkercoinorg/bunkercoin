"use client";

import { useEffect } from "react";
import { initX, trackXConversionOnce } from "@/components/util/x";

export function XPixel() {
    useEffect(() => {
        initX();
        trackXConversionOnce("tw-on6qi-pd16h");
    }, []);
    return null;
}
