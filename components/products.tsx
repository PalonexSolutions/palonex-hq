import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { productPath, products, type Product } from "@/features/ecosystem";

function ConceptStatus() {
  return <span className="status">Concept</span>;
}

function ProductArtwork({ product: { icon: Icon, motif } }: { product: Product }) {
  return (
    <div className="product-art" data-motif={motif} aria-hidden="true">
      <span className="product-art-lines" />
      <span className="product-art-icon"><Icon strokeWidth={1.15} /></span>
    </div>
  );
}

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const Heading = compact ? "h3" : "h2";

  return (
    <article className="product-card card">
      <ProductArtwork product={product} />
      <div className="product-card-body">
        <div className="product-card-meta"><span>{product.category}</span><ConceptStatus /></div>
        <Heading>{product.name}</Heading>
        <p>{product.description}</p>
        <Link className="text-link product-card-link" href={productPath(product.slug)}>
          Explore {product.name} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function ProductHero({ product }: { product: Product }) {
  return (
    <header className="product-hero" data-layout={product.useCasesFirst ? "reverse" : "standard"}>
      <div>
        <Link className="text-link product-back" href="/products"><ArrowLeft size={16} aria-hidden /> All products</Link>
        <div className="product-card-meta"><span>{product.category}</span><ConceptStatus /></div>
        <h1>{product.name}</h1>
        <p className="product-headline">{product.headline}</p>
        <p className="lede">{product.description}</p>
      </div>
      <ProductArtwork product={product} />
    </header>
  );
}

export function ProductFeatureSection({ title, items }: {
  title: string;
  items: Product["capabilities"];
}) {
  return (
    <section className="product-section">
      <h2>{title}</h2>
      <ul className="product-feature-list">
        {items.map((item) => (
          <li className="card" key={item.title}><h3>{item.title}</h3><p>{item.text}</p></li>
        ))}
      </ul>
    </section>
  );
}

export function ProductNavigation({ product }: { product: Product }) {
  const next = products[(products.indexOf(product) + 1) % products.length];
  return (
    <nav className="product-navigation" aria-label="Explore more product concepts">
      <Link className="text-link" href="/products"><ArrowLeft size={16} aria-hidden /> All products</Link>
      <Link className="text-link" href={productPath(next.slug)}>Next concept: {next.name} <ArrowRight size={16} aria-hidden /></Link>
    </nav>
  );
}

export function ProductCallToAction() {
  return <Link className="button primary" href="/products">Explore the portfolio <ArrowRight size={16} aria-hidden /></Link>;
}
