import type { Metadata } from "next";
import { ProductCard } from "@/components/products";
import { PageIntro } from "@/components/site";
import { products } from "@/features/ecosystem";

export const metadata: Metadata = {
  title: "AI product concepts",
  description: "Explore the seven concepts planned for the PaLoNex AI SuperApp.",
  alternates: { canonical: "/products" },
  openGraph: { title: "PaLoNex AI product concepts", description: "Explore seven planned AI products from PaLoNex.", url: "/products", type: "website", siteName: "PaLoNex" },
};

export default function Products() {
  return <div className="shell content-page">
    <PageIntro label="PRODUCTS" title="AI product concepts">Seven ideas for the planned PaLoNex AI SuperApp, spanning education, accessibility and everyday needs.</PageIntro>
    <div className="card-grid three product-directory">
      {products.map((product) => <ProductCard key={product.slug} product={product} />)}
    </div>
  </div>;
}
