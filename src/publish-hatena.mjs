import { readFile } from "node:fs/promises";

const post = JSON.parse(await readFile("out/post.json", "utf8"));
const user = process.env.HATENA_USER;
const apiKey = process.env.HATENA_API_KEY;
const blogId = "beetle-life-jp-blog.hatenablog.com";

for (const [name, value] of Object.entries({
  HATENA_USER: user,
  HATENA_API_KEY: apiKey,
  HATENA_BLOG_ID: blogId
})) {
  if (!value) throw new Error(name + " is not set");
}

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

function decodeXmlText(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function normalizeTitle(value) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja");
}

const tags = post.tags
  .map((tag) => '<category term="' + escapeXml(tag) + '" />')
  .join("\n  ");

const xml = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<entry xmlns="http://www.w3.org/2005/Atom">',
  "  <title>" + escapeXml(post.title) + "</title>",
  '  <content type="html">' + escapeXml(post.html) + "</content>",
  '  <summary type="text">' + escapeXml(post.excerpt) + "</summary>",
  "  " + tags,
  "</entry>"
].join("\n");

const endpoint = "https://blog.hatena.ne.jp/" +
  encodeURIComponent(user) + "/" +
  encodeURIComponent(blogId) + "/atom/entry";
const auth = Buffer.from(user + ":" + apiKey).toString("base64");
const duplicateCheck = await fetch(endpoint, {
  headers: { "Authorization": "Basic " + auth, "Accept": "application/atom+xml" }
});
if (!duplicateCheck.ok) {
  throw new Error("Hatena entry list unavailable; publication stopped to prevent duplicates (HTTP " + duplicateCheck.status + ")");
}
const feedXml = await duplicateCheck.text();
if (!/<feed\b[^>]*>/i.test(feedXml)) {
  throw new Error("Hatena entry list could not be parsed; publication stopped to prevent duplicates");
}
const existingTitles = [...feedXml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry\s*>/gi)]
  .map(([, entry]) => entry.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1])
  .filter(Boolean)
  .map((title) => normalizeTitle(decodeXmlText(title)));
if (existingTitles.includes(normalizeTitle(post.title))) {
  console.log(JSON.stringify({ published: false, skipped: true, reason: "duplicate_title", title: post.title }));
  process.exit(0);
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Authorization": "Basic " + auth,
    "Content-Type": "application/x.atom+xml; charset=utf-8",
    "User-Agent": "hatena-auto-publisher/1.0"
  },
  body: xml
});

const responseText = await response.text();
if (!response.ok) {
  const detail = responseText.replace(/\s+/g, " ").slice(0, 1200);
  console.error("::error title=Hatena API::HTTP " + response.status + ": " + detail);
  throw new Error("Hatena AtomPub failed (" + response.status + "): " + detail);
}

console.log(JSON.stringify({
  published: true,
  title: post.title,
  location: response.headers.get("location"),
  status: response.status
}));
