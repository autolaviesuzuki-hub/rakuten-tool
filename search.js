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

    // 特定ショップ（旧形式）
    let targetHit = null;
    for (const shop of TARGET_SHOPS) {
      const hit = items.find(it => it.shop.includes(shop));
      if (hit) {
        targetHit = hit;
        break;
      }
    }

    // TOP3（旧形式）
    const top3 = items
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);

    allResults.push({
      asin: m.asin,
      model: m.model,
      size: m.size,

      shop: targetHit ? targetHit.shop : null,
      title: targetHit ? targetHit.title : null,
      price: targetHit ? targetHit.price : null,
      url: targetHit ? targetHit.url : null,

      top3: top3
    });
  }

  const blob = new Blob([JSON.stringify(allResults, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "rakuten_results.json";
  a.click();
}
