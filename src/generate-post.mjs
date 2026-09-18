import { mkdir, readFile, writeFile } from "node:fs/promises";

const brief = JSON.parse(await readFile("content/first-post.json", "utf8"));
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

const fallbackPost = {
  title: brief.title,
  excerpt: "便利さだけでは語れない空冷ビートルの魅力。丸いデザイン、機械を身近に感じる楽しさ、不便さを含めて今も乗りたいと思う理由を整理します。",
  metaDescription: brief.metaDescription,
  tags: ["空冷ビートル", "空冷VW", "旧車", "フォルクスワーゲン", "クラシックカー"],
  html: [
    "<p>車が便利な道具になった今でも、私は空冷ビートルに乗りたいと思っています。</p>",
    "<p>燃費が特別にいいわけではありません。最新の安全装備が付いているわけでもなく、エアコンやナビが当たり前に使える車でもありません。それでも、空冷ビートルには、便利さだけでは説明できない魅力があります。</p>",
    "<h2>形を見ただけで気持ちが動く</h2>",
    "<p>空冷ビートルの魅力は、まずその姿です。</p>",
    "<p>丸みを帯びたボディ、独特のフェンダー、左右に並んだ丸いヘッドライト。何十年も前に生まれた車なのに、今見ても古さだけではなく、愛嬌があります。</p>",
    "<p>最近の車は、空気抵抗や安全性、室内の広さなどを考えて、よく似た形になりがちです。その中で空冷ビートルは、遠くから見てもすぐに分かります。駐車場に停まっているだけでも目に入り、走っている姿を見かけると、思わず振り返ってしまいます。</p>",
    "<p>車は移動するためのものと考えれば、空冷ビートルは効率のよい選択ではありません。でも、所有したいと思わせる力は、現代の車にはないものだと感じます。</p>",
    "<h2>機械を身近に感じられる</h2>",
    "<p>空冷ビートルは、現代の車のように何でもコンピューターが管理してくれる車ではありません。</p>",
    "<p>エンジンの音や振動、走り方の変化などから、車の状態を感じ取る場面があります。調子がよいときの音、少し気になる音、季節や気温による違い。そうした変化に気づくと、単なる移動手段ではなく、機械と付き合っている感覚になります。</p>",
    "<p>もちろん、手がかかることを楽しめなければ、維持するのは大変かもしれません。故障や部品の交換もありますし、現代の車と同じ感覚で乗ることはできません。</p>",
    "<p>それでも、自分で状態を確認し、必要な手入れをして、また走れるようにする。その積み重ねが、車への愛着につながっていくのだと思います。実際の整備や安全に関わる判断は、専門店や有資格者に相談することが大切です。</p>",
    "<h2>不便だからこそ記憶に残る</h2>",
    "<p>空冷ビートルに乗るなら、多少の不便さは受け入れなければなりません。</p>",
    "<p>すぐに目的地へ着くことだけを考えれば、もっと新しくて快適な車はいくらでもあります。けれども、空冷ビートルで出かけると、移動そのものが思い出になります。</p>",
    "<p>エンジンの音を聞きながら走ること。信号待ちで周囲の人の視線を感じること。古い車について知らない人から声をかけられること。そうした一つひとつが、普通の移動とは違う時間を作ってくれます。</p>",
    "<p>不便さは、見方を変えれば、車と過ごす時間を増やしてくれる要素なのかもしれません。</p>",
    "<h2>古い車に乗る前に考えておきたいこと</h2>",
    "<p>空冷ビートルに興味があっても、見た目の魅力だけで決めるのは少し危険です。購入するなら、車両価格だけでなく、整備履歴、部品の状態、保管場所、日常の使い方まで考えておきたいところです。</p>",
    "<p>車両の状態や必要な整備は一台ごとに違います。販売店の説明を聞くだけでなく、可能であれば空冷VWに詳しい専門店にも確認し、無理なく維持できるかを考えることが大切です。</p>",
    "<h2>今だからこそ乗ってみたい</h2>",
    "<p>空冷ビートルは、いつまでも同じ状態で残っている車ではありません。年月が経つほど、程度のよい車や部品は少なくなっていきます。乗ってみたいと思っているうちに、選べる車が減ってしまう可能性もあります。</p>",
    "<p>だからこそ、今も空冷ビートルに乗りたいと思います。</p>",
    "<p>最新の車には、最新の車にしかない安心感や快適さがあります。一方で、空冷ビートルには、古い車でなければ味わえない魅力があります。どちらが優れているという話ではなく、何を大切にして車を選ぶかという違いです。</p>",
    "<p>私は、速さや便利さだけではなく、乗るたびに気持ちが動く車を選びたい。少し手がかかっても、眺めるだけでうれしくなり、走り出せばその時間を楽しめる車に乗りたい。</p>",
    "<p>それが、今も空冷ビートルに乗りたいと思う理由です。</p>",
    "<p>いつか空冷ビートルに乗る日が来たら、走った距離だけでなく、手入れをした時間や立ち止まって眺めた時間も含めて、ゆっくり楽しんでいきたいと思います。</p>"
  ].join("\n")
};

let post;
try {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const systemPrompt = [
    "あなたは日本語の個人ブログ編集者です。",
    "空冷VWに乗りたい読者に向けて、空冷ビートルの魅力と、今も乗りたいと思う理由を語る記事を書きます。",
    "筆者が現時点で空冷VWを所有しているとは断定しないでください。",
    "所有、運転、修理、整備を筆者自身の体験談として創作してはいけません。",
    "筆者の関心や考えとして、デザイン、機械らしさ、不便さ、古い車と付き合う楽しさを自然に説明してください。",
    "確認できない価格、年式、走行距離、修理費、燃費、故障原因、店名などの具体情報を創作しないでください。",
    "故障や安全に関する内容は一般論にとどめ、購入や整備の判断は専門店への確認を促してください。",
    "読者に語りかける、落ち着いた個人ブログの文体にしてください。",
    "本文はHTML本文のみとし、script、style、iframe、画像URL、Markdownは使わないでください。",
    "本文はタグを除いた日本語の文字数で1800〜2500文字程度にしてください。"
  ].join("\n");
  const userPrompt = [
    "次の企画から、はてなブログに投稿できる記事を1本作成してください。",
    "タイトルは企画のタイトルをそのまま使ってください。",
    "",
    JSON.stringify(brief, null, 2),
    "",
    "JSONのみで返し、キーは title, excerpt, metaDescription, tags, html の5つに固定してください。",
    "htmlはh2、p、ul、li、strong、em、brだけで構成してください。"
  ].join("\n");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.8, response_format: { type: "json_object" }, messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ] })
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 1200);
    throw new Error("OpenAI API failed (" + response.status + "): " + detail);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no message content");
  post = JSON.parse(content);
} catch (error) {
  console.warn("OpenAI generation unavailable; using the checked-in fallback article: " + error.message);
  post = fallbackPost;
}

for (const key of ["title", "excerpt", "metaDescription", "html"]) {
  if (typeof post[key] !== "string" || !post[key].trim()) throw new Error("Generated post is missing a valid " + key);
}
if (!Array.isArray(post.tags) || post.tags.length === 0) throw new Error("Generated post is missing tags");
const plainTextLength = post.html.replace(/<[^>]*>/g, "").replace(/\s+/g, "").length;
if (plainTextLength < 1600) console.warn("Generated post is below the recommended length: " + plainTextLength + " characters");

const output = { ...post, generatedAt: new Date().toISOString(), model, sourceBrief: brief.title, plainTextLength, belowRecommendedLength: plainTextLength < 1600 };
await mkdir("out", { recursive: true });
await writeFile("out/post.json", JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({ generated: true, title: output.title, tags: output.tags, plainTextLength: output.plainTextLength, output: "out/post.json" }));
