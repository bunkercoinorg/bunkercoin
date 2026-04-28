import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, XIcon } from "lucide-react";

const Header: React.FC = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navItems: { label: string; href: string }[] = [
        // { label: "Explorer", href: "https://explorer.bunkercoin.io" },
        // { label: "Our Bunker", href: "/our-bunker" },
        // { label: "Blog", href: "https://blog.bunkercoin.io" },
        // { label: "App", href: "https://app.bunkercoin.io" },
    ];

    return (
        <header className="fixed top-0 w-full flex flex-col backdrop-blur-md bg-black/5 z-[100]">
            <div className="container mx-auto px-6 py-8 flex items-center justify-between">
                <div className="flex-shrink-0">
                    <Link href="/">
                        <img
                            src="/img/bunkercoin-icon.svg"
                            alt="Logo"
                            className="h-8 w-auto"
                        />
                    </Link>
                </div>

                <nav className="hidden md:flex space-x-6">
                    {navItems.map((item) => (
                        <Link key={item.label} href={item.href} passHref>
                            <Button className="bg-transparent hover:bg-neutral-50/10">
                                {item.label}
                            </Button>
                        </Link>
                    ))}
                </nav>

                {/* mobile menu button - hidden
                <div className="md:hidden">
                    <button
                        onClick={() => setMobileMenuOpen((prev) => !prev)}
                        aria-label="Toggle mobile menu"
                        className="p-2 rounded-md focus:outline-none"
                    >
                        {mobileMenuOpen ? <XIcon /> : <Menu size={24} />}
                    </button>
                </div>
                */}
            </div>

            {mobileMenuOpen && (
                <nav className="md:hidden border-t border-neutral-700 w-full h-screen pt-4">
                    <div className="px-4 py-2 flex flex-col space-y-2">
                        {navItems.map((item) => (
                            <Link key={item.label} href={item.href} passHref>
                                <Button variant="ghost" className="w-full text-left text-lg">
                                    {item.label}
                                </Button>
                            </Link>
                        ))}
                    </div>
                </nav>
            )}
        </header>
    );
};

export default Header;
