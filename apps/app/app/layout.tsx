import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "BunkerCoin App",
  description: "WebApp and Hub for BunkerCoin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-white`}>
        <SidebarProvider>
          <div className="flex h-screen bg-neutral-950 w-full">
            <AppSidebar />
            <main className="flex-1 overflow-y-auto bg-neutral-950">
              <div className="absolute top-0 left-0">
                <SidebarTrigger className="size-8 flex md:hidden"/>
              </div>
              {children}
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}