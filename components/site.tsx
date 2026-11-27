import { ArrowRight, Orbit } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  ["About", "/about"], ["Products", "/products"], ["PaLoLabs", "/labs"],
  ["Opportunities", "/opportunities"],
] as const;

function Brand() {
  return <Link href="/" className="brand"><span className="brand-icon"><Orbit size={21} aria-hidden /></span>PaLo<span>Nex</span></Link>;
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand />
        <nav aria-label="Main navigation">
          {navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <Link className="button header-action" href="/#contact">Get in touch <ArrowRight size={15} aria-hidden /></Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div><Brand /><p>Palonex Solutions Private Limited</p></div>
        <nav aria-label="Footer navigation">
          {navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </div>
    </footer>
  );
}

export function PageIntro({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return <header className="page-intro"><p className="eyebrow">{label}</p><h1>{title}</h1><p className="lede">{children}</p></header>;
}
