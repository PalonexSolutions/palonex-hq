import type { Metadata } from "next";
import { PageIntro } from "@/components/site";

export const metadata: Metadata = {
  title: "PaLoLabs",
  description: "Explore PaLoNex’s research and innovation direction.",
  alternates: { canonical: "/labs" },
};

export default function Labs() {
  return <div className="shell content-page">
    <PageIntro label="RESEARCH AND INNOVATION" title="PaLoLabs">PaLoLabs is the home of PaLoNex’s planned research and experiments in applied AI, accessibility and engineering.</PageIntro>
    <div className="card-grid three">
      <section className="card"><h2 className="text-xl">Applied AI</h2><p>Explore ways to use AI and machine learning for practical tasks.</p></section>
      <section className="card"><h2 className="text-xl">Accessibility</h2><p>Investigate technology that supports visual assistance and communication.</p></section>
      <section className="card"><h2 className="text-xl">Publications</h2><p>PaLoLabs has yet to publish research or experimental results.</p></section>
    </div>
  </div>;
}
