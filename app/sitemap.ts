import type { MetadataRoute } from "next";

import { productPath, products } from "@/features/ecosystem";

import { toolPath, tools } from "@/features/tools/catalog";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/products", "/labs", "/opportunities", "/tools", ...tools.map(({ slug }) => toolPath(slug)), ...products.map(({ slug }) => productPath(slug))].map(path => ({
    url: new URL(path, "https://palonexsolutions.in").href,
  }));
}
