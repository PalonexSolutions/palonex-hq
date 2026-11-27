import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/products", "/labs", "/opportunities"].map(path => ({
    url: new URL(path, "https://palonexsolutions.in").href,
  }));
}
