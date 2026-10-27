// Builds the public website in /site from the app in /app/index.html.
// - adds search/share metadata, icons and the install manifest to the page head
// - stamps the service worker with a version so phones pick up new releases
// Run: node scripts/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const SITE_URL = "https://psx-pilot.netlify.app";
const app = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");

const viewport = '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">';
if (!app.includes(viewport)) throw new Error("app/index.html: viewport meta not found, head layout changed");

const title = "PSX Personal Assistant";
const description = "Track your Pakistan Stock Exchange shares, average price, dividends and profit in one place. A private family hub for three portfolios.";
const head = [
  `<meta name="description" content="${description}">`,
  `<meta name="theme-color" content="#08090B">`,
  `<link rel="icon" href="/icon-192.png" type="image/png">`,
  `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
  `<link rel="manifest" href="/manifest.webmanifest">`,
  `<link rel="canonical" href="${SITE_URL}/">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:site_name" content="${title}">`,
  `<meta property="og:title" content="${title} — your shares, our accounts">`,
  `<meta property="og:description" content="${description}">`,
  `<meta property="og:url" content="${SITE_URL}/">`,
  `<meta property="og:image" content="${SITE_URL}/og.png">`,
  `<meta property="og:image:width" content="1200">`,
  `<meta property="og:image:height" content="630">`,
  `<meta name="twitter:card" content="summary_large_image">`,
  `<meta name="twitter:title" content="${title}">`,
  `<meta name="twitter:description" content="${description}">`,
  `<meta name="twitter:image" content="${SITE_URL}/og.png">`,
].join("");

const page = app.replace(viewport, viewport + head);
writeFileSync(new URL("../site/index.html", import.meta.url), page);

const version = createHash("sha256").update(page).digest("hex").slice(0, 12);
const sw = readFileSync(new URL("./sw.template.js", import.meta.url), "utf8").replace("__VERSION__", version);
writeFileSync(new URL("../site/sw.js", import.meta.url), sw);

console.log(`site built · ${(page.length / 1024).toFixed(0)} KB · sw ${version}`);
