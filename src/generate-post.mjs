import { mkdir, readFile, writeFile } from "node:fs/promises";

const brief = JSON.parse(await readFile("content/first-post.json", "utf8"));
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not set");
}

const systemPrompt = [
  "あなたは日本語の個人ブログ編集者です。",
  "空冷VWを購入する前の読者に向けて、検索で役立つ実用的なチェックガイドを書きます。",
  "筆者は現時点で空冷VWを所有していません。",
  "記事は購入前の確認事項、比較、チェックリスト、専門店への質問を中心にしてください。",
  "所有、運転、修理、整備を筆者自身の体験談として書いてはいけません。",
  "公開情報、販売情報、専門家の説明、オーナーの体験談を区別してください。",
  "価格、年式、走行距離、修理費、燃費、故障原因、店名など、確認できない具体情報を創作しないでください。",
  "結論を先に書き、読者が確認すべき項目を箇条書きや表現で分かりやすく整理してください。",
  "整備や安全に関する内容は、専門店や有資格者への確認を促してください。",
  "本文はHTML本文のみとし、script、style、iframe、画像URL、Markdownは使わないでください。",
  "本文はタグを除いた日本語の文字数で1800〜2500文字程度にしてください。",
  "広告やアフィリエイトを含める場合は、広告であることを明示してください。"
].join("\n");
const userPrompt = [
  "次の企画から、はてなブログに投稿できる記事を1本作成してください。",
  "",
  JSON.stringify(brief, null, 2),
  "",
  "JSONのみで返し、キーは次の5つに固定してください。",
  "- title: 30文字前後のタイトル",
  "- excerpt: 80〜120文字程度の導入要約",
  "- metaDescription: 120〜160文字程度の検索向け説明",
  "- tags: 3〜6個のタグ配列",
  "- html: h2、p、ul、li、strong、em、brだけで構成した本文HTML。タグを除いた本文は1800〜2500文字程度"
].join("\n");

const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + apiKey,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model,
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  })
});

if (!response.ok) {
  const detail = await response.text();
  throw new Error("OpenAI API failed (" + response.status + "): " + detail);
}

const payload = await response.json();
const content = payload.choices?.[0]?.message?.content;
if (!content) {
  throw new Error("OpenAI returned no message content");
}

let post;
try {
  post = JSON.parse(content);
} catch (error) {
  throw new Error("OpenAI returned invalid JSON: " + error.message);
}

for (const key of ["title", "excerpt", "metaDescription", "html"]) {
  if (typeof post[key] !== "string" || !post[key].trim()) {
    throw new Error("Generated post is missing a valid " + key);
  }
}
if (!Array.isArray(post.tags) || post.tags.length === 0) {
  throw new Error("Generated post is missing tags");
}
const plainTextLength = post.html
  .replace(/<[^>]*>/g, "")
  .replace(/\s+/g, "")
  .length;
if (plainTextLength < 1600) {
  console.warn("Generated post is below the recommended length: " + plainTextLength + " characters");
}

const output = {
  ...post,
  generatedAt: new Date().toISOString(),
  model,
  sourceBrief: brief.title,
  plainTextLength,
  belowRecommendedLength: plainTextLength < 1600
};

await mkdir("out", { recursive: true });
await writeFile("out/post.json", JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({
  generated: true,
  title: output.title,
  tags: output.tags,
  plainTextLength: output.plainTextLength,
  output: "out/post.json"
}));