"use client";

import { useState } from "react";
import { ArrowRight, Braces, Code, FileDiff, FileSpreadsheet, Fingerprint, Hash, Link2, Type } from "lucide-react";
import Link from "next/link";
import { toolPath, tools } from "./catalog";

const icons = { json: Braces, csv: FileSpreadsheet, diff: FileDiff, base64: Code, url: Link2, sha256: Fingerprint, uuid: Hash, text: Type };
const categories = [...new Set(tools.map(tool => tool.category))];

export function ToolDirectory() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const results = tools.filter(tool => (!category || category === tool.category)
    && tool.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <div className="tool-workbench tool-search">
      <div className="tool-settings">
        <label>Search tools <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name" /></label>
        <label>Category <select value={category} onChange={event => setCategory(event.target.value)}>
          <option value="">All categories</option>{categories.map(name => <option key={name}>{name}</option>)}
        </select></label>
      </div>
      <p role="status">{results.length} {results.length === 1 ? "tool" : "tools"} found</p>
    </div>
    <div className="card-grid three">
      {results.map(tool => {
        const Icon = icons[tool.slug];
        return <Link className="card interactive tool-card" href={toolPath(tool.slug)} key={tool.slug}>
          <div className="card-top"><Icon size={25} aria-hidden /><span className="status">{tool.category}</span></div>
          <h2>{tool.name}</h2><p>{tool.description}</p>
          <span className="text-link">Open tool <ArrowRight size={16} aria-hidden /></span>
        </Link>;
      })}
    </div>
    {!results.length && <button className="button" onClick={() => { setQuery(""); setCategory(""); }}>Reset filters</button>}
  </>;
}
