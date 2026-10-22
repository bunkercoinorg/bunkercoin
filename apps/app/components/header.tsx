"use client"

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, XIcon } from "lucide-react";

const Header: React.FC = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    const navItems = [
        { label: "Home", href: "https://bunkercoin.io" },
        { label: "Transparency", href: "/transparency" },
        { label: "Buybacks", href: "/buybacks" },
        { label: "Staking", href: "#", comingSoon: true },
    ];

    const isActive = (href: string) => {
        if (href.startsWith("http")) return false;
        return pathname === href;
    };

    return (
        <header className="fixed top-0 w-full flex flex-col backdrop-blur-md bg-black/5 z-[100]">
            <div className="container mx-auto px-6 py-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/img/bunkercoin-icon.svg"
                            alt="Logo"
                            className="h-8 w-auto"
                        />
                    </Link>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-semibold">BunkerCoin App</h1>
                        <span className="text-xs text-neutral-500">v1.0.0</span>
                    </div>
                </div>

                <nav className="hidden md:flex items-center space-x-4">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        return item.comingSoon ? (
                            <Button 
                                key={item.label} 
                                className="bg-transparent hover:bg-neutral-50/10 opacity-50 cursor-not-allowed"
                                disabled
                            >
                                {item.label}
                                <span className="ml-2 text-xs text-bunker-green">Soon</span>
                            </Button>
                        ) : (
                            <Link key={item.label} href={item.href} passHref>
                                <Button 
                                    className={`bg-transparent hover:bg-neutral-50/10 ${
                                        active ? 'bg-neutral-50/10' : ''
                                    }`}
                                >
                                    {item.label}
                                </Button>
                            </Link>
                        );
                    })}
                </nav>

                <div className="md:hidden">
                    <button
                        onClick={() => setMobileMenuOpen((prev) => !prev)}
                        aria-label="Toggle mobile menu"
                        className="p-2 rounded-md focus:outline-none"
                    >
                        {mobileMenuOpen ? <XIcon className="text-white" /> : <Menu size={24} className="text-white" />}
                    </button>
                </div>
            </div>

            {mobileMenuOpen && (
                <nav className="md:hidden border-t border-neutral-700 w-full h-screen pt-4 bg-neutral-950">
                    <div className="px-4 py-2 flex flex-col space-y-2">
                        {navItems.map((item) => {
                            const active = isActive(item.href);
                            return item.comingSoon ? (
                                <Button 
                                    key={item.label} 
                                    variant="ghost" 
                                    className="w-full text-left text-lg justify-start opacity-50 cursor-not-allowed"
                                    disabled
                                >
                                    {item.label}
                                    <span className="ml-auto text-xs text-bunker-green">Soon</span>
                                </Button>
                            ) : (
                                <Link key={item.label} href={item.href} passHref>
                                    <Button 
                                        variant="ghost" 
                                        className={`w-full text-left text-lg justify-start ${
                                            active ? 'bg-neutral-800' : ''
                                        }`}
                                    >
                                        {item.label}
                                    </Button>
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            )}
        </header>
    );
};

export default Header; 