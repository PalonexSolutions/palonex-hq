import type { MetadataRoute } from "next";

import { productPath, products } from "@/features/ecosystem";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/products", "/labs", "/opportunities", ...products.map(({ slug }) => productPath(slug))].map(path => ({
    url: new URL(path, "https://palonexsolutions.in").href,
  }));
}
