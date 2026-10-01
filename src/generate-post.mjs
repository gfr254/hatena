import { mkdir, readFile, writeFile } from "node:fs/promises";

const config = JSON.parse(await readFile("content/first-post.json", "utf8"));
const { topics, ...blogBrief } = config;
if (!Array.isArray(topics) || topics.length < 2) throw new Error("The editorial topic queue must contain at least two topics");
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const blogId = process.env.HATENA_BLOG_ID || "beetle-life-jp-blog.hatenablog.com";

function japanDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return { year: Number(value("year")), month: Number(value("month")), day: Number(value("day")) };
}

function normalizeTitle(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("ja-JP");
}

function decodeXml(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

async function fetchRecentTitles() {
  const response = await fetch("https://" + blogId + "/rss", { headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) throw new Error("Could not read Hatena RSS (HTTP " + response.status + ")");
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const titleMatch = match[1].match(/<title>([\s\S]*?)<\/title>/);
    return titleMatch ? decodeXml(titleMatch[1].replace(/<[^>]*>/g, "").trim()) : "";
  }).filter(Boolean);
}

const { year, month, day } = japanDateParts();
const publishDate = [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
const dayIndex = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
const startIndex = dayIndex % topics.length;
let recentTitles = [];
try {
  recentTitles = await fetchRecentTitles();
} catch (error) {
  console.warn("Could not read recent titles for topic rotation: " + error.message);
}
const recentTitleSet = new Set(recentTitles.map(normalizeTitle));
let selectedTopic = null;
for (let offset = 0; offset < topics.length; offset += 1) {
  const candidate = topics[(startIndex + offset) % topics.length];
  if (!recentTitleSet.has(normalizeTitle(candidate.title))) {
    selectedTopic = candidate;
    break;
  }
}
if (!selectedTopic) throw new Error("Every queued topic appears in the recent Hatena feed; refusing to generate a repeat");
const brief = { ...blogBrief, ...selectedTopic, publishDate };
console.log(JSON.stringify({ selectedTopic: brief.title, publishDate, recentTitlesChecked: recentTitles.length }));

if (!apiKey) throw new Error("OPENAI_API_KEY is not set; refusing to publish a static fallback article");
const systemPrompt = [
  "あなたは日本語の個人ブログ編集者です。",
  "今回選ばれた企画の題名、切り口、見出しに沿って、過去の記事と内容が重ならない記事を作成してください。",
  "ブログは空冷VWの購入検討、仕組み、維持、旅について、確認できる情報と実用的な確認方法を伝えます。",
  "筆者が現時点で空冷VWを所有しているとは断定しないでください。所有、運転、修理、整備を筆者自身の体験談として創作してはいけません。",
  "確認できない価格、年式、走行距離、修理費、燃費、故障原因、店名などの具体情報を創作しないでください。",
  "安全や整備に関わる内容は一般論にとどめ、車両ごとの判断は専門店への確認を促してください。",
  "指定された企画の範囲に集中し、毎回同じ定型見出しや結論を繰り返さないでください。",
  "落ち着いた個人ブログの文体にしてください。本文はHTMLのみとし、script、style、iframe、画像URL、Markdownは使わないでください。",
  "本文はタグを除いた日本語の文字数で1800〜2500文字程度にしてください。"
].join("\n");
const userPrompt = [
  "次の企画から、はてなブログに投稿できる記事を1本作成してください。titleは企画のtitleを一字一句そのまま使ってください。metaDescriptionは今回の記事内容に合わせて新しく作成してください。",
  "企画:", JSON.stringify(brief, null, 2),
  "JSONのみで返し、キーは title, excerpt, metaDescription, tags, html の5つに固定してください。",
  "htmlはh2、p、ul、li、strong、em、brだけで構成してください。"
].join("\n");

const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({ model, temperature: 0.8, response_format: { type: "json_object" }, messages: [
    { role: "system", content: systemPrompt }, { role: "user", content: userPrompt }
  ] })
});
if (!response.ok) {
  const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 1200);
  throw new Error("OpenAI API failed (" + response.status + "): " + detail);
}
const payload = await response.json();
const content = payload.choices?.[0]?.message?.content;
if (!content) throw new Error("OpenAI returned no message content");
const post = JSON.parse(content);
for (const key of ["title", "excerpt", "metaDescription", "html"]) {
  if (typeof post[key] !== "string" || !post[key].trim()) throw new Error("Generated post is missing a valid " + key);
}
if (post.title.trim() !== brief.title) throw new Error("Generated title does not match the selected topic; refusing to publish");
if (!Array.isArray(post.tags) || post.tags.length === 0) throw new Error("Generated post is missing tags");
const plainTextLength = post.html.replace(/<[^>]*>/g, "").replace(/\s+/g, "").length;
if (plainTextLength < 1600) throw new Error("Generated post is too short: " + plainTextLength + " characters");

const output = { ...post, generatedAt: new Date().toISOString(), model, sourceBrief: brief.title, topicDate: publishDate, plainTextLength };
await mkdir("out", { recursive: true });
await writeFile("out/post.json", JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({ generated: true, title: output.title, tags: output.tags, plainTextLength: output.plainTextLength, output: "out/post.json" }));
