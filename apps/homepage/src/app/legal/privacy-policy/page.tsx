import React from 'react';
import { Link } from "@/components/bc/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import { SiteFooter } from "@/components/bc/shell";

const PrivacyPolicy = () => {
    return (
        <>
        <main className="w-full min-h-screen bg-black text-white flex flex-col items-center justify-center">

                <div className="absolute top-4 left-4 z-50">
                    <Link href="/">
                        <Button variant="ghost" className="">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
                        </Button>
                    </Link>
                </div>

                <h1 className="text-5xl font-bold mt-12 md:mt-6 mb-6">
                    Privacy Policy
                </h1>

                <div className="mb-24 z-20 flex flex-col gap-y-6 border border-neutral-800 rounded-lg w-[90vw] md:w-[60vw] p-8 md:p-12 backdrop-blur-sm overflow-y-auto max-h-[70vh]">
                    <p className="text-sm italic">Last updated: 04.08.2024</p>

                    <section>
                        <h2 className="text-2xl font-semibold text-white">1. Introduction</h2>
                        <p>Welcome to The Bunker (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our services.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white">2. Information We Collect</h2>
                        <p>We collect personal information that you voluntarily provide to us when you use our website or services. This may include:</p>
                        <ul className="list-disc list-inside pl-4">
                            <li>Contact information (such as email address)</li>
                            <li>Usage data (such as IP address, browser type, and version)</li>
                            <li>User agent information</li>
                            <li>Form submission data</li>
                        </ul>
                        <p>We also automatically collect certain information when you visit, use, or navigate our website. This information does not reveal your specific identity but may include:</p>
                        <ul className="list-disc list-inside pl-4">
                            <li>Device and usage information</li>
                            <li>Browser and device characteristics</li>
                            <li>Operating system</li>
                            <li>Language preferences</li>
                            <li>Referring URLs</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white">3. How We Use Your Information</h2>
                        <p>We use the information we collect for various purposes, including:</p>
                        <ul className="list-disc list-inside pl-4">
                            <li>Providing, operating, and maintaining our website</li>
                            <li>Improving, personalizing, and expanding our website</li>
                            <li>Understanding and analyzing how you use our website</li>
                            <li>Developing new products, services, features, and functionality</li>
                            <li>Communicating with you about our services</li>
                            <li>Preventing fraud and abuse of our services</li>
                            <li>Web analytics (via Cloudflare)</li>
                            <li>Anti-bot protection</li>
                            <li>Processing form submissions (via Tally)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white">4. Third-Party Services</h2>
                        <p>We use the following third-party services to help us operate our website and provide our services:</p>
                        <ul className="list-disc list-inside pl-4">
                            <li>Cloudflare: Used for web analytics, security, and content delivery. Cloudflare may collect IP addresses, system configuration information, and other usage data.</li>
                            <li>Google reCAPTCHA: Used for bot protection. Google may collect hardware and software information, such as device and application data, to provide, maintain, and improve reCAPTCHA.</li>
                            <li>Tally: Used for form submissions. Tally may collect the information you provide in our forms, as well as technical information about how you interact with the forms.</li>
                        </ul>
                        <p>These services may collect and process your data according to their own privacy policies. We recommend reviewing their privacy policies for more information on how they handle your data.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white">5. Data Retention</h2>
                        <p>We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white">6. Data Security</h2>
                        <p>We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white">7. Your Rights</h2>
                        <p>Depending on your location, you may have certain rights regarding your personal information. These may include:</p>
                        <ul className="list-disc list-inside pl-4">
                            <li>The right to access your personal data</li>
                            <li>The right to rectify or update your personal data</li>
                            <li>The right to erase your personal data</li>
                            <li>The right to restrict processing of your personal data</li>
                            <li>The right to object to processing of your personal data</li>
                            <li>The right to data portability</li>
                            <li>The right to withdraw consent</li>
                        </ul>
                        <p>To exercise these rights, please contact us using the information provided in the &quot;Contact Us&quot; section.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white">8. Changes to This Privacy Policy</h2>
                        <p>We may update this Privacy Policy from time to time. The updated version will be indicated by an updated &quot;Last updated&quot; date and the updated version will be effective as soon as it is accessible. We encourage you to review this Privacy Policy frequently to be informed of how we are protecting your information.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white">9. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy or our privacy practices, please contact us at:</p>
                        <p><a href="mailto:contact@bunkercoin.io" className="hover:underline">contact@bunkercoin.io</a></p>
                    </section>
                </div>
        </main>
            <SiteFooter />
        </>
    );
};

export default PrivacyPolicy;