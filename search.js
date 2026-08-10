// ===============================
// 特定ショップ（新API対応・拡張版）
// ===============================
const TARGET_SHOPS = [
  // NIKE公式
  "NIKE", "nike", "NIKE 公式", "NIKE 公式 楽天市場店", "nike-official",

  // Xebio
  "Xebio", "ゼビオ", "Super Sports XEBIO", "スーパースポーツゼビオ",
  "スポーツゼビオ", "supersportsxebio",

  // Victoria 系
  "Victoria", "ヴィクトリア",
  "Victoria Surf&Snow", "Victoria L-Breath", "Victoria Golf",
  "Victoria 楽天市場支店",

  // アルペン系
  "アルペン", "Alpen", "アルペン楽天市場店",
  "スポーツデポ", "Sports Depot", "スポーツデポ楽天市場店",

  // ヒマラヤ系
  "ヒマラヤ", "Himaraya",
  "ヒマラヤ楽天市場店", "ヒマラヤアウトドア専門店",

  // ABC-MART系
  "ABC", "ABCMart", "ABC-MART", "ABC-MART楽天市場店",

  // アネックススポーツ
  "アネックス", "アネックススポーツ",

  // OnStep
  "OnStep",

  // ブランド古着ベクトル系
  "ブランド古着", "ベクトル",
  "ブランド古着ベクトル", "ブランド古着ベクトルプレミアム店"
];

// ===============================
// 中古品判定（除外）
// ===============================
function isUsed(itemName) {
  const ng = ["中古", "USED", "used", "リユース", "古着"];
  return ng.some(word => itemName.includes(word));
}

// ===============================
// 楽天検索（新API対応）
// ===============================
async function searchRakutenAll() {
  const applicationId = "a38ecc5b-5a90-4eb9-b4f8-e714ba84eefd";
  const accessKey = "pk_oRPj9UEOAjvjnUtRwKwaje85mgY98Nzo7rzvGf7sQRj";

  const models = await fetch("models.json").then(r => r.json());
  let allResults = [];

  for (const m of models) {

    // ===============================
    // 新API向け keyword（型番の揺れ＋ブランド名）
    // ===============================
    const keywords = [
      m.model,                                 // DC1460-007
      m.model.replace("-", ""),                // DC1460007
      m.model.replace("-", " "),               // DC1460 007
      m.model.replace("-", "　"),              // DC1460　007
      `ナイキ ${m.model}`,                     // ナイキ DC1460-007
      `NIKE ${m.model}`                        // NIKE DC1460-007
    ];

    let items = [];

    // ===============================
    // 新API検索（hits=30 が最も安定）
    // ===============================
    for (const kw of keywords) {
      const url =
        "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"
        + "?applicationId=" + applicationId
        + "&accessKey=" + accessKey
        + "&keyword=" + encodeURIComponent(kw)
        + "&hits=30"
        + "&format=json"
        + "&sort=%2BitemPrice";

      try {
        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        const list = data.Items || [];

        for (const it of list) {
          const item = it.Item;

          // ★中古品は除外
          if (isUsed(item.itemName)) continue;

          items.push({
            shop: item.shopName,
            title: item.itemName,
            price: item.itemPrice,
            url: item.itemUrl
          });
        }
      } catch (e) {
        console.log("エラー:", e);
      }
    }

    // ===============================
    // 特定ショップ判定（items 全体に対して）
    // ===============================
    let targetHit = null;
    for (const shopKey of TARGET_SHOPS) {
      const hit = items.find(it => it.shop.includes(shopKey));
      if (hit) {
        targetHit = hit;
        break;
      }
    }

    // ===============================
    // TOP3（最安値順）
    // ===============================
    const sorted = items.sort((a, b) => a.price - b.price);
    const top3 = sorted.slice(0, 3);

    // ===============================
    // 特定ショップがあれば最優先
    // ===============================
    const finalResult = targetHit || top3[0] || null;

    // ===============================
    // JSON 出力形式（Python が読み込める旧形式）
    // ===============================
    allResults.push({
      asin: m.asin,
      model: m.model,
      size: m.size,

      shop: finalResult ? finalResult.shop : null,
      title: finalResult ? finalResult.title : null,
      price: finalResult ? finalResult.price : null,
      url: finalResult ? finalResult.url : null,

      top3: top3
    });
  }

  // ===============================
  // JSON ダウンロード
  // ===============================
  const blob = new Blob([JSON.stringify(allResults, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "rakuten_results.json";
  a.click();
}
