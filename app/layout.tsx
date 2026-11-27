import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://palonexsolutions.in"),
  title: { default: "PaLoNex | AI, learning and engineering", template: "%s | PaLoNex" },
  description: "Palonex Solutions Private Limited brings together artificial intelligence, education, engineering and opportunity.",
  openGraph: { type: "website", siteName: "PaLoNex" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><SiteHeader /><main id="main">{children}</main><SiteFooter /></body></html>;
}
