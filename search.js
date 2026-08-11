// ===============================
// APIキー
// ===============================
const applicationId = "a38ecc5b-5a90-4eb9-b4f8-e714ba84eefd";
const accessKey = "pk_oRPj9UEOAjvjnUtRwKwaje85mgY98Nzo7rzvGf7sQRj";

// ===============================
// models.json 読み込み
// ===============================
async function loadModels() {
  return await fetch("models.json").then(r => r.json());
}

// ===============================
// itemCode検索（最優先）
// ===============================
async function searchByItemCode(itemCode) {
  const url =
    "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"
    + `?applicationId=${applicationId}`
    + `&accessKey=${accessKey}`
    + `&itemCode=${itemCode}`
    + "&format=json";

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.Items) return [];
    return json.Items.map(i => i.Item);
  } catch {
    return [];
  }
}

async function tryItemCodeSearch(modelEntry) {
  if (!modelEntry.itemCodes || modelEntry.itemCodes.length === 0) return null;

  for (const code of modelEntry.itemCodes) {
    const items = await searchByItemCode(code);
    if (items.length > 0) return items;
  }
  return null;
}

// ===============================
// 型番検索（高速化版）
// ===============================
function buildUrl(keyword) {
  return (
    "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"
    + `?applicationId=${applicationId}`
    + `&accessKey=${accessKey}`
    + `&keyword=${encodeURIComponent(keyword)}`
    + "&hits=30"
    + "&format=json"
    + "&sort=%2BitemPrice"
  );
}

async function searchByModel(model) {
  const keywords = [
    model,
    model.replace("-", ""),
    `NIKE ${model}`
  ];

  const promises = keywords.map(kw => fetch(buildUrl(kw)));
  const responses = await Promise.all(promises);

  let items = [];

  for (const res of responses) {
    if (!res.ok) continue;

    const data = await res.json();
    const list = data.Items || [];

    for (const it of list) {
      const item = it.Item;

      if (isUsed(item.itemName)) continue;

      items.push({
        shop: item.shopName,
        title: item.itemName,
        price: item.itemPrice,
        url: item.itemUrl
      });
    }
  }

  return items;
}

// ===============================
// 中古除外
// ===============================
function isUsed(name) {
  const ng = ["中古", "USED", "used", "リユース", "古着"];
  return ng.some(w => name.includes(w));
}

// ===============================
// 特定ショップ優先
// ===============================
const TARGET_SHOPS = [
  "NIKE", "nike", "NIKE 公式", "NIKE 公式 楽天市場店",
  "Xebio", "ゼビオ", "Super Sports XEBIO",
  "Victoria", "ヴィクトリア",
  "アルペン", "スポーツデポ",
  "ヒマラヤ", "ABC-MART"
];

function filterSpecialShops(items) {
  for (const key of TARGET_SHOPS) {
    const hit = items.find(it => it.shop.includes(key));
    if (hit) return hit;
  }
  return null;
}

// ===============================
// 最安値TOP3
// ===============================
function extractTop3(items) {
  return items.sort((a, b) => a.price - b.price).slice(0, 3);
}

// ===============================
// searchRakutenAll（高速化版）
// ===============================
async function searchRakutenAll() {

  const models = await loadModels();
  let allResults = [];

  for (const m of models) {

    // ① itemCode検索
    let items = await tryItemCodeSearch(m);

    // ② 型番検索（並列化）
    if (!items) {
      items = await searchByModel(m.model);
    }

    // ③ 特定ショップ優先
    const special = filterSpecialShops(items);

    // ④ 最安値TOP3
    const top3 = extractTop3(items);

    // ⑤ 最終結果
    const finalResult = special || top3[0] || null;

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

  // JSONダウンロード
  const blob = new Blob([JSON.stringify(allResults, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "rakuten_results.json";
  a.click();
}
