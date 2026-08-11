// ===============================
// Rakuten API Keys
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
// 429対策：軽い待機
// ===============================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
// 型番検索（高速化＋429対策）
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

  // 429対策：キーワードは1回だけ
  const keywords = [model];

  let items = [];

  for (const kw of keywords) {

    // 429対策：API呼び出し間に待機
    await sleep(200);

    const res = await fetch(buildUrl(kw));
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
// メイン処理：searchRakutenAll（完全版）
// ===============================
async function searchRakutenAll() {

  const models = await loadModels();
  let allResults = [];

  for (const m of models) {

    // ① itemCode検索（最優先）
    let items = await tryItemCodeSearch(m);

    // ② 型番検索（429対策済み）
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

  // ===============================
  // rakuten_results.json 自動ダウンロード
  // ===============================
  const blob = new Blob([JSON.stringify(allResults, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "rakuten_results.json";
  a.click();

  // ===============================
  // models_updated.json 自動ダウンロード（学習結果）
  // ===============================
  const blob2 = new Blob([JSON.stringify(models, null, 2)], {
    type: "application/json"
  });
  const a2 = document.createElement("a");
  a2.href = URL.createObjectURL(blob2);
  a2.download = "models_updated.json";
  a2.click();
}
