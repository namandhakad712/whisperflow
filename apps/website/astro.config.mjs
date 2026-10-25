// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// TODO: point `site` at the real domain before first public deploy.
export default defineConfig({
  site: "https://whisperflow.dev",
  trailingSlash: "ignore",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
