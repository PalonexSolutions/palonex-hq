import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation = [
  ["About", "/about"], ["Products", "/products"], ["PaLoLabs", "/labs"],
  ["Opportunities", "/opportunities"], ["Tools", "/tools"],
] as const;

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="PaLoNex home">
      <Image src="/brand/palonex-logo.png" alt="" width={806} height={993} unoptimized />
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand />
        <nav aria-label="Main navigation">
          {navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="header-controls">
          <ThemeToggle />
          <Link className="button header-action" href="/#contact">Get in touch <ArrowRight size={15} aria-hidden /></Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <Link href="/" className="brand-lockup">
            <Image src="/brand/palonex-name-slogan.png" alt="PaLoNex — Tools that think. Steps that work."
              width={602} height={227} unoptimized />
          </Link>
          <p>Palonex Solutions Private Limited</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/privacy">Privacy</Link>
          {navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </div>
    </footer>
  );
}

export function PageIntro({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return <header className="page-intro"><p className="eyebrow">{label}</p><h1>{title}</h1><p className="lede">{children}</p></header>;
}
