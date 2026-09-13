import { readFile } from "node:fs/promises";

const post = JSON.parse(await readFile("out/post.json", "utf8"));
const user = process.env.HATENA_USER;
const apiKey = process.env.HATENA_API_KEY;
const blogId = process.env.HATENA_BLOG_ID;

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
  throw new Error("Hatena AtomPub failed (" + response.status + "): " + responseText);
}

console.log(JSON.stringify({
  published: true,
  title: post.title,
  location: response.headers.get("location"),
  status: response.status
}));