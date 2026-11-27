import type { Metadata } from "next";
import { PageIntro } from "@/components/site";

export const metadata: Metadata = {
  title: "Learning and opportunities",
  description: "Learn about the planned PaLoNex InternHub and Connect platforms.",
  alternates: { canonical: "/opportunities" },
};

export default function Opportunities() {
  return <div className="shell content-page">
    <PageIntro label="LEARNING AND COMMUNITY" title="Opportunities to learn and build">PaLoNex plans two platforms for students and developers to gain practical experience and share their work.</PageIntro>
    <section className="section" id="internhub"><h2>InternHub</h2><p className="lede">A planned platform for internships, courses, assessments and project submissions. Applications will open when opportunities are announced.</p></section>
    <section className="section" id="connect"><h2>Connect</h2><p className="lede">A planned developer community for project showcases, technical discussions, coding challenges and hackathons.</p></section>
  </div>;
}
