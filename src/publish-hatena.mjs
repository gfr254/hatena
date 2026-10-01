import { readFile } from "node:fs/promises";

const post = JSON.parse(await readFile("out/post.json", "utf8"));
const user = process.env.HATENA_USER;
const apiKey = process.env.HATENA_API_KEY;
const blogId = process.env.HATENA_BLOG_ID || "beetle-life-jp-blog.hatenablog.com";
for (const [name, value] of Object.entries({ HATENA_USER: user, HATENA_API_KEY: apiKey, HATENA_BLOG_ID: blogId })) {
  if (!value) throw new Error(name + " is not set");
}

function japanDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return value("year") + "-" + value("month") + "-" + value("day");
}
function normalizeTitle(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("ja-JP");
}
function decodeXml(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

const feedResponse = await fetch("https://" + blogId + "/rss", { headers: { "Cache-Control": "no-cache" } });
if (!feedResponse.ok) throw new Error("Could not verify recent Hatena posts (HTTP " + feedResponse.status + "); refusing to publish");
const feedXml = await feedResponse.text();
const recentEntries = [...feedXml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
  const titleMatch = match[1].match(/<title>([\s\S]*?)<\/title>/);
  const dateMatch = match[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/);
  return {
    title: titleMatch ? decodeXml(titleMatch[1].replace(/<[^>]*>/g, "").trim()) : "",
    pubDate: dateMatch ? decodeXml(dateMatch[1].trim()) : ""
  };
});
const today = japanDateKey(new Date());
const alreadyPublishedToday = recentEntries.some((entry) => {
  const date = new Date(entry.pubDate);
  return entry.pubDate && !Number.isNaN(date.getTime()) && japanDateKey(date) === today;
});
const titleAlreadyUsed = recentEntries.some((entry) => normalizeTitle(entry.title) === normalizeTitle(post.title));

if (alreadyPublishedToday || titleAlreadyUsed) {
  console.log(JSON.stringify({ published: false, skipped: true,
    reason: alreadyPublishedToday ? "A Hatena post already exists for today in Asia/Tokyo" : "This title already exists in the recent Hatena feed",
    title: post.title }));
} else {
  const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&apos;");
  const tags = post.tags.map((tag) => '<category term="' + escapeXml(tag) + '" />').join("\n  ");
  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>', '<entry xmlns="http://www.w3.org/2005/Atom">',
    "  <title>" + escapeXml(post.title) + "</title>",
    '  <content type="html">' + escapeXml(post.html) + "</content>",
    '  <summary type="text">' + escapeXml(post.excerpt) + "</summary>", "  " + tags, "</entry>"
  ].join("\n");
  const endpoint = "https://blog.hatena.ne.jp/" + encodeURIComponent(user) + "/" + encodeURIComponent(blogId) + "/atom/entry";
  const auth = Buffer.from(user + ":" + apiKey).toString("base64");
  const response = await fetch(endpoint, { method: "POST", headers: {
    "Authorization": "Basic " + auth, "Content-Type": "application/x.atom+xml; charset=utf-8", "User-Agent": "hatena-auto-publisher/1.0"
  }, body: xml });
  const responseText = await response.text();
  if (!response.ok) {
    const detail = responseText.replace(/\s+/g, " ").slice(0, 1200);
    console.error("::error title=Hatena API::HTTP " + response.status + ": " + detail);
    throw new Error("Hatena AtomPub failed (" + response.status + "): " + detail);
  }
  console.log(JSON.stringify({ published: true, title: post.title, location: response.headers.get("location"), status: response.status }));
}
