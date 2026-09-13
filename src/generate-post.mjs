import { mkdir, readFile, writeFile } from "node:fs/promises";

const brief = JSON.parse(await readFile("content/first-post.json", "utf8"));
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not set");
}

const systemPrompt = [
  "あなたは日本語の個人ブログ編集者です。",
  "空冷フォルクスワーゲン・ビートルと暮らす読者に向けて、検索にも見つかりやすいが広告っぽくない記事を書きます。",
  "与えられた事実と構成だけを使い、実在の整備履歴、正確な走行ルート、店名、日付、数値、故障診断などは創作しないでください。",
  "整備項目は一般的な出発前確認として表現し、危険な作業を読者に断定的に勧めないでください。",
  "本文はHTML本文のみとし、script、style、iframe、画像URL、Markdownは使わないでください。",
  "文体は一人称の自然な日本語で、見出し、段落、箇条書きを使って読みやすくしてください。"
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
  "- html: h2、p、ul、li、strong、em、brだけで構成した本文HTML"
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

const output = {
  ...post,
  generatedAt: new Date().toISOString(),
  model,
  sourceBrief: brief.title
};

await mkdir("out", { recursive: true });
await writeFile("out/post.json", JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({
  generated: true,
  title: output.title,
  tags: output.tags,
  output: "out/post.json"
}));