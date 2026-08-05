// ===============================
// 中古品判定（除外）
// ===============================
function isUsed(itemName) {
  const ng = ["中古", "USED", "used", "リユース", "古着"];
  return ng.some(word => itemName.includes(word));
}

// ===============================
// 楽天検索（TOP3返却・特定ショップ判定なし）
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
    // TOP3（最安値順）
    // ===============================
    const sorted = items.sort((a, b) => a.price - b.price);
    const top3 = sorted.slice(0, 3);

    // ===============================
    // JSON 出力形式（Python が読み込める旧形式）
    // ===============================
    allResults.push({
      asin: m.asin,
      model: m.model,
      size: m.size,

      // TOP1（最安値）
      shop: top3[0] ? top3[0].shop : null,
      title: top3[0] ? top3[0].title : null,
      price: top3[0] ? top3[0].price : null,
      url: top3[0] ? top3[0].url : null,

      // TOP3（配列）
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
