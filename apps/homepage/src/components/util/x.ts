// @ts-nocheck

export const initX = () => {
    const initializeTwq = (windowObj: any, documentObj: Document, elementType: string) => {
        if (!windowObj.twq) {
            const twitterEventTracker = (windowObj.twq = (...args: any[]) => {
                twitterEventTracker.exe
                    ? twitterEventTracker.exe.apply(twitterEventTracker, args)
                    : twitterEventTracker.queue.push(args);
            });
            twitterEventTracker.version = '1.1';
            twitterEventTracker.queue = [];

            const twitterScriptElement = documentObj.createElement(elementType);
            twitterScriptElement.async = true;
            twitterScriptElement.src = 'https://static.ads-twitter.com/uwt.js';

            const firstScript = documentObj.getElementsByTagName(elementType)[0];
            firstScript.parentNode?.insertBefore(twitterScriptElement, firstScript);
        }
    };

    initializeTwq(window, document, 'script');
    window.twq('config', 'on6qi');
};

export const trackXConversionOnce = (eventId: string, conversionId?: string) => {
    const params = new URLSearchParams(window.location.search);
    const hasTwclid = params.has('twclid');
    const alreadyTracked = localStorage.getItem('x-tracked') === 'true';

    if (hasTwclid && !alreadyTracked && typeof window.twq === 'function') {
        window.twq('event', eventId, {
            conversion_id: conversionId ?? null,
        });
        localStorage.setItem('x-tracked', 'true');
    }
};