import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google"; // Added JetBrains Mono for numbers/data
import "./globals.css";
import { Providers } from "./providers";
import { FontLoader } from "./components/FontLoader";
import { Navigation } from "./components/Navigation";
import { BackgroundConfetti } from "./components/BackgroundConfetti";

// Main font for UI text
const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

// Monospace font for prices, addresses, and data tables (Classic trading look)
const mono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Scratch Card FHE Game | Sepolia",
  description: "Scratch Card FHE Game with full privacy protected by Zama FHEVM on Ethereum Sepolia.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Scratch Card FHE Game | Sepolia",
    description: "Scratch Card FHE Game with full privacy protected by Zama FHEVM on Ethereum Sepolia.",
    url: "https://sepolia.etherscan.io",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body 
        className={`
          ${inter.variable} ${mono.variable} font-mono antialiased 
          bg-background text-white 
          selection:bg-monad-purple/30 selection:text-monad-purple
          min-h-screen relative overflow-x-hidden
        `}
      >
        <Providers>
          <FontLoader />
          <Navigation />
          <BackgroundConfetti />
          {/* Subtle Ambient Background Glow */}
          <div className="fixed inset-0 -z-10 h-full w-full bg-background">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-monad-purple/5 blur-[120px] rounded-full pointer-events-none" />
          </div>
          <main>
            {children}
          </main>
          <footer className="border-t border-card-border bg-black/70 backdrop-blur-sm">
            <div className="relative overflow-hidden py-3">
              <p className="footer-marquee whitespace-nowrap text-xs font-semibold tracking-widest text-monad-purple">
                SCRATCH CARD FHE GAME • FULL PRIVACY PROTECTED BY ZAMA FHEVM • ETHEREUM SEPOLIA • SCRATCH CARD FHE GAME • FULL PRIVACY PROTECTED BY ZAMA FHEVM • ETHEREUM SEPOLIA
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
