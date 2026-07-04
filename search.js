async function searchRakutenAll() {
  const applicationId = "a38ecc5b-5a90-4eb9-b4f8-e714ba84eefd";
  const accessKey = "pk_oRPj9UEOAjvjnUtRwKwaje85mgY98Nzo7rzvGf7sQRj";

  // models.json を読み込む
  const models = await fetch("models.json").then(r => r.json());
  let results = [];

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

    results.push(...items);
  }

  // 結果を JSON としてダウンロード
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "rakuten_results.json";
  a.click();
}
