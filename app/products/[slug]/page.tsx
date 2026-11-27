import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCallToAction, ProductFeatureSection, ProductHero, ProductNavigation } from "@/components/products";
import { productPath, products } from "@/features/ecosystem";

type Props = { params: Promise<{ slug: string }> };

async function getProduct(params: Props["params"]) {
  const { slug } = await params;
  const product = products.find((entry) => entry.slug === slug);
  if (!product) notFound();
  return product;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, description, slug } = await getProduct(params);
  const title = `${name} AI concept`;
  const url = productPath(slug);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "PaLoNex" },
  };
}

export default async function ProductDetail({ params }: Props) {
  const product = await getProduct(params);
  const capabilities = { title: "Proposed capabilities", items: product.capabilities };
  const useCases = { title: "Example use cases", items: product.useCases };
  const sections = product.useCasesFirst ? [useCases, capabilities] : [capabilities, useCases];

  return (
    <div className="shell content-page product-detail">
      <ProductHero product={product} />
      <div className="product-story">
        <section><h2>The problem</h2><p>{product.problem}</p></section>
        <section><h2>The proposed solution</h2><p>{product.solution}</p></section>
        <section><h2>Who it’s for</h2><p>{product.audience}</p></section>
      </div>
      {sections.map((section) => <ProductFeatureSection key={section.title} {...section} />)}
      <section className="product-direction card">
        <div><h2>Future development</h2><p>{product.direction}</p></div>
        <ProductCallToAction />
      </section>
      <ProductNavigation product={product} />
    </div>
  );
}
