import type { Metadata } from "next";
import { PageIntro } from "@/components/site";
import { products } from "@/features/ecosystem";

export const metadata: Metadata = {
  title: "AI product concepts",
  description: "Explore the seven concepts planned for the PaLoNex AI SuperApp.",
  alternates: { canonical: "/products" },
};

export default function Products() {
  return <div className="shell content-page">
    <PageIntro label="PRODUCTS" title="AI product concepts">Seven ideas for the planned PaLoNex AI SuperApp, spanning education, accessibility and everyday needs.</PageIntro>
    <div className="card-grid three">
      {products.map(({ name, category, description, icon: Icon }) => <article key={name} className="card">
        <div className="card-top"><Icon size={23} aria-hidden /><span className="status">Concept</span></div>
        <h2 className="text-xl">{name}</h2><p>{category}</p><p>{description}</p>
      </article>)}
    </div>
  </div>;
}
