// ===============================
// 指定ショップ（部分一致）
// ===============================
const TARGET_SHOPS = [
  "NIKE",
  "Xebio",
  "Victoria",
  "ﾈｸｻｽ",
  "ｱﾙﾍﾟﾝ",
  "ﾋﾏﾗﾔ",
  "ABCMart",
  "ABC-MART",
  "Alpen",
  "Himaraya"
];

// ===============================
// 楽天検索URL生成
// ===============================
function makeRakutenSearchUrl(model, shop) {
  return `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(model + " " + shop)}/`;
}

// ===============================
// メイン処理
// ===============================
async function searchRakutenAll() {
  const applicationId = "a38ecc5b-5a90-4eb9-b4f8-e714ba84eefd";
  const accessKey = "pk_oRPj9UEOAjvjnUtRwKwaje85mgY98Nzo7rzvGf7sQRj";

  // models.json 読み込み
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

          items.push({
            asin: m.asin,
            model: m.model,
            size: m.size,
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
    // 指定ショップ判定
    // ===============================
    const shopResults = {};
    for (const shop of TARGET_SHOPS) {
      const hit = items.filter(it => it.shop.includes(shop));
      if (hit.length > 0) {
        shopResults[shop] = {
          status: "hit",
          item: hit[0], // 最安値（sort済み）
          searchUrl: makeRakutenSearchUrl(m.model, shop)
        };
      } else {
        shopResults[shop] = {
          status: "none",
          item: null,
          searchUrl: null
        };
      }
    }

    // ===============================
    // 指定外 TOP3
    // ===============================
    const sorted = items.sort((a, b) => a.price - b.price);
    const top3 = sorted.slice(0, 3).map(it => ({
      ...it,
      searchUrl: makeRakutenSearchUrl(m.model, it.shop)
    }));

    // ===============================
    // 全体結果に追加
    // ===============================
    allResults.push({
      asin: m.asin,
      model: m.model,
      size: m.size,
      shops: shopResults,
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
