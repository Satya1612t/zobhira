import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/login", "/profile", "/progress"] },
    ],
    sitemap: "https://zobhira.com/sitemap.xml",
  };
}
