import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageIntro } from "@/components/site";
import { tools, toolPath } from "@/features/tools/catalog";
import { Converter } from "@/features/tools/converters";
import { DiffWorkspace, TextWorkspace } from "@/features/tools/text-workspaces";
import { HashWorkspace, UuidWorkspace } from "@/features/tools/crypto-workspaces";
import "../tools.css";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;

export function generateStaticParams() { return tools.map(({ slug }) => ({ slug })); }

async function getTool(params: Props["params"]) {
  const { slug } = await params;
  const tool = tools.find(entry => entry.slug === slug);
  if (!tool) notFound();
  return tool;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, description, slug } = await getTool(params);
  const url = toolPath(slug);
  return { title: name, description, alternates: { canonical: url }, openGraph: { title: name, description, url } };
}

export default async function ToolPage({ params }: Props) {
  const tool = await getTool(params);
  const { slug } = tool;
  return <div className="shell content-page tool-page">
    <Link className="text-link tool-back" href="/tools"><ArrowLeft size={16} aria-hidden /> All engineering tools</Link>
    <PageIntro label={tool.category} title={tool.name}>{tool.description}</PageIntro>
    <p className="tool-privacy">Your input stays in this browser.</p>
    {slug === "diff" ? <DiffWorkspace /> : slug === "text" ? <TextWorkspace />
      : slug === "sha256" ? <HashWorkspace /> : slug === "uuid" ? <UuidWorkspace /> : <Converter kind={slug} />}
    <nav className="tool-navigation" aria-label="Other engineering tools">
      {tools.filter(entry => entry.slug !== slug).map(entry => <Link className="text-link" href={toolPath(entry.slug)} key={entry.slug}>{entry.name}</Link>)}
    </nav>
  </div>;
}
