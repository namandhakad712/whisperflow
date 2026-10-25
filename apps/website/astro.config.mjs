// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Deployed to GitHub Pages: https://namandhakad712.github.io/whisperflow/
export default defineConfig({
  site: "https://namandhakad712.github.io",
  base: "/whisperflow",
  trailingSlash: "ignore",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
