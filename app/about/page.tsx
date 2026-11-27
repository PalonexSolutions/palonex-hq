import type { Metadata } from "next";
import { PageIntro } from "@/components/site";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about the vision, mission and technology philosophy of Palonex Solutions Private Limited.",
  alternates: { canonical: "/about" },
};

export default function About() {
  return <div className="shell content-page">
    <PageIntro label="ABOUT" title="Palonex Solutions Private Limited">PaLoNex is a technology and AI-focused product company building an ecosystem for students, innovators, developers and professionals.</PageIntro>
    <div className="card-grid three">
      <section className="card"><h2>Our story</h2><p>PaLoNex grew from a vision to bring education, AI, research, engineering tools, career opportunities and developer communities into one ecosystem.</p></section>
      <section className="card"><h2>Vision</h2><p>Make technology more useful and accessible through practical products and learning opportunities.</p></section>
      <section className="card"><h2>Mission</h2><p>Help people learn, experiment and solve real problems with technology.</p></section>
    </div>
    <section className="section"><h2>Technology philosophy</h2><p className="lede">Start with practical needs. Make tools accessible, give learners room to experiment, and use AI where it can help people accomplish something specific.</p></section>
    <section className="section"><h2>Leadership</h2><p className="lede">Leadership profiles are awaiting founder input.</p></section>
  </div>;
}
