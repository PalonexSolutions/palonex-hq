import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Blocks, BrainCircuit, FlaskConical, GraduationCap, Network, Terminal } from "lucide-react";
import { products } from "@/features/ecosystem";

export const metadata: Metadata = { alternates: { canonical: "/" }, openGraph: { url: "/" } };

const pillars = [
  { name: "PaLoNex HQ", description: "The home of our products, research and engineering work.", icon: Blocks, href: "/about", status: "Company platform" },
  { name: "AI SuperApp", description: "Seven AI product concepts for everyday needs.", icon: BrainCircuit, href: "/products", status: "Planned" },
  { name: "InternHub", description: "Practical learning and internship opportunities for students.", icon: GraduationCap, href: "/opportunities#internhub", status: "Planned" },
  { name: "Connect", description: "A developer community for sharing projects and building together.", icon: Network, href: "/opportunities#connect", status: "Planned" },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="shell hero-inner">
          <div className="hero-copy">
            <p className="eyebrow"><span className="signal" /> PALONEX SOLUTIONS PRIVATE LIMITED</p>
            <h1>Building with AI.<br /><span>Building for people.</span></h1>
            <p className="lede">PaLoNex brings AI, engineering and practical learning together to help students, developers and innovators build what comes next.</p>
            <div className="actions">
              <Link href="#ecosystem" className="button primary">Explore the ecosystem <ArrowDown size={17} aria-hidden /></Link>
              <Link href="/about" className="button">About PaLoNex <ArrowRight size={17} aria-hidden /></Link>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <Image src="/hero.webp" alt="" fill preload sizes="(max-width: 760px) 100vw, 55vw" />
          </div>
        </div>
      </section>

      <section className="section ecosystem" id="ecosystem">
        <div className="shell">
          <p className="eyebrow">THE PALONEX ECOSYSTEM</p>
          <h2>Four ways to build with PaLoNex</h2>
          <p className="lede">Explore our company platform and what we’re planning across AI, learning and developer collaboration.</p>
          <div className="card-grid pillars">
            {pillars.map(({ name, description, icon: Icon, href, status }) => (
              <Link key={name} href={href} className="card interactive">
                <div className="card-top"><Icon size={23} aria-hidden /><ArrowRight size={17} aria-hidden /></div>
                <h3>{name}</h3><p>{description}</p><span className="status">{status}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading">
          <div><p className="eyebrow">AI PRODUCTS</p><h2>AI for everyday needs</h2></div>
          <Link href="/products" className="text-link">See all seven concepts <ArrowRight size={17} aria-hidden /></Link>
        </div>
        <div className="card-grid three">
          {products.filter(({ name }) => ["FoodSnap", "SkillEdge", "TalkSign"].includes(name)).map(({ name, description, icon: Icon }) => (
            <article key={name} className="card">
              <div className="card-top"><Icon size={23} aria-hidden /><span className="status">Concept</span></div>
              <h3>{name}</h3><p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section shell">
        <div className="card-grid three">
          <article className="card"><FlaskConical className="accent" aria-hidden /><h3>PaLoLabs</h3><p>Our research and innovation direction across applied AI, accessibility and engineering.</p><Link className="text-link" href="/labs">Explore PaLoLabs <ArrowRight size={16} aria-hidden /></Link></article>
          <article className="card"><Terminal className="accent" aria-hidden /><h3>Engineering tools</h3><p>Planned browser tools include a JSON formatter, a text and data converter, and a unit converter.</p></article>
          <article className="card"><GraduationCap className="accent" aria-hidden /><h3>Learning and opportunity</h3><p>Explore our plans for practical projects, internships and a learning platform for students.</p><Link className="text-link" href="/opportunities">Explore opportunities <ArrowRight size={16} aria-hidden /></Link></article>
        </div>
      </section>

      <section className="section closing" id="contact">
        <div className="shell closing-inner">
          <div><p className="eyebrow">VISION AND MISSION</p><h2>Make technology more useful and accessible.</h2><p className="lede">Our mission is to create practical technology products and learning opportunities for students, developers, innovators and professionals.</p><Link className="text-link" href="/about">About the company <ArrowRight size={16} aria-hidden /></Link></div>
          <div className="card"><h3>Business enquiries</h3><p>The enquiry form is planned for a future release.</p></div>
        </div>
      </section>
    </>
  );
}
