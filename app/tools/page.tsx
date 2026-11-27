import type { Metadata } from "next";
import { PageIntro } from "@/components/site";
import { ToolDirectory } from "@/features/tools/directory";
import "./tools.css";

const description = "Practical tools for developers. Built to make everyday engineering easier.";
export const metadata: Metadata = {
  title: "Engineering Tools",
  description,
  alternates: { canonical: "/tools" },
  openGraph: { title: "PaLoNex Engineering Tools", description, url: "/tools" },
};

export default function ToolsPage() {
  return <div className="shell content-page tool-page">
    <PageIntro label="DEVELOPER UTILITIES" title="PaLoNex Engineering Tools">{description}</PageIntro>
    <p className="tool-privacy">Processing stays in this browser. The tools do not upload or save your text or files.</p>
    <ToolDirectory />
  </div>;
}
