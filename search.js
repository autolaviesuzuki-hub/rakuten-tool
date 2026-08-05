// ===============================
// 特定ショップ（ゆるい判定）
// ===============================
const TARGET_SHOPS = [
  "NIKE",
  "nike",
  "Victoria",
  "ヴィクトリア",
  "Xebio",
  "ゼビオ",
  "アルペン",
  "Alpen",
  "スポーツデポ",
  "ヒマラヤ",
  "Himaraya",
  "ABC",
  "ABCMart",
  "ABC-MART",
  "アネックス",
  "OnStep",
  "ブランド古着",
];

// ===============================
// 中古品判定（除外）
// ===============================
function isUsed(itemName) {
  const ng = ["中古", "USED", "used", "リユース", "古着"];
  return ng.some(word => itemName.includes(word));
}

// ===============================
// 楽天検索
// ===============================
async function searchRakutenAll() {
  const applicationId = "a38ecc5b-5a90-4eb9-b4f8-e714ba84eefd";
  const accessKey = "pk_oRPj9UEOAjvjnUtRwKwaje85mgY98Nzo7rzvGf7sQRj";

  const models = await fetch("models.json").then(r => r.json());
  let allResults = [];

  for (const m of models) {
    const keywords = [
      m.model,
      m.model.replace("-", ""),
      m.model.replace("-", " "),
      m.model.replace("-", "　")
    ];

    let items = [];

    // ===============================
    // 楽天API検索（複数キーワード）
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
    // 特定ショップ判定（ゆるい）
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
    // 特定ショップ非ヒット → TOP1（最安値）
    // ===============================
    let finalResult = null;

    if (targetHit) {
      finalResult = targetHit;
    } else {
      const sorted = items.sort((a, b) => a.price - b.price);
      finalResult = sorted[0] || null;
    }

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
      url: finalResult ? finalResult.url : null
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
