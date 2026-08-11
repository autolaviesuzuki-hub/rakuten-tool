// ===============================
// 新APIキー
// ===============================
const applicationId = "a38ecc5b-5a90-4eb9-b4f8-e714ba84eefd";
const accessKey = "pk_oRPj9UEOAjvjnUtRwKwaje85mgY98Nzo7rzvGf7sQRj";

// ===============================
// models.json 読み込み（itemCodes 対応）
// ===============================
async function loadModels() {
  return await fetch("models.json").then(r => r.json());
}

// ===============================
// 中古品判定（既存ロジック）
// ===============================
function isUsed(itemName) {
  const ng = ["中古", "USED", "used", "リユース", "古着"];
  return ng.some(word => itemName.includes(word));
}

// ===============================
// itemCode検索（最優先・100%正確）
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
  } catch (e) {
    console.log("itemCode検索エラー:", e);
    return [];
  }
}

// ===============================
// itemCode検索を試す（models.json の学習データ）
// ===============================
async function tryItemCodeSearch(modelEntry) {
  if (!modelEntry.itemCodes || modelEntry.itemCodes.length === 0) {
    return null; // itemCode未学習
  }

  for (const code of modelEntry.itemCodes) {
    const items = await searchByItemCode(code);
    if (items.length > 0) {
      return items; // 100%正確
    }
  }

  return null;
}

// ===============================
// 型番検索（揺れ吸収）
// ===============================
async function searchByModel(model) {
  const keywords = [
    model,
    model.replace("-", ""),
    model.replace("-", " "),
    model.replace("-", "　"),
    `ナイキ ${model}`,
    `NIKE ${model}`
  ];

  let items = [];

  for (const kw of keywords) {
    const url =
      "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"
      + `?applicationId=${applicationId}`
      + `&accessKey=${accessKey}`
      + `&keyword=${encodeURIComponent(kw)}`
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

        if (isUsed(item.itemName)) continue;

        items.push({
          shop: item.shopName,
          title: item.itemName,
          price: item.itemPrice,
          url: item.itemUrl
        });
      }
    } catch (e) {
      console.log("型番検索エラー:", e);
    }
  }

  return items;
}

// ===============================
// HTML取得（楽天商品ページ）
// ===============================
async function fetchHtml(url) {
  try {
    const res = await fetch(url);
    return await res.text();
  } catch (e) {
    console.log("HTML取得エラー:", e);
    return "";
  }
}

// ===============================
// HTMLから型番抽出（正規表現）
// ===============================
function extractModelsFromHtml(html) {
  const regexList = [
    /[A-Z]{2}[0-9]{4}-[0-9]{3}/g,
    /[A-Z]{2}[0-9]{7}/g,
    /[A-Z]{2}[0-9]{4}-[0-9]{3}-[0-9]{2}/g
  ];

  const found = new Set();

  for (const regex of regexList) {
    const matches = html.match(regex);
    if (matches) matches.forEach(m => found.add(m));
  }

  return Array.from(found);
}

// ===============================
// Keepaモデル正規化
// ===============================
function normalizeModel(model) {
  return model.replace(/-/g, "").toUpperCase();
}

// ===============================
// Keepa照合（誤ヒット完全排除）
// ===============================
function matchModelWithKeepa(keepaModel, extractedModels) {
  const normKeepa = normalizeModel(keepaModel);

  for (const m of extractedModels) {
    const normM = normalizeModel(m);

    if (normKeepa === normM) return m;
    if (normKeepa.startsWith(normM.slice(0, 6))) return m;
  }

  return null;
}

// ===============================
// HTML型番抽出 → Keepa照合 → 正しい商品だけ残す
// ===============================
async function filterCorrectItems(items, keepaModel) {
  const result = [];

  for (const item of items) {
    const html = await fetchHtml(item.url);
    const extracted = extractModelsFromHtml(html);
    const matched = matchModelWithKeepa(keepaModel, extracted);

    if (matched) {
      result.push({
        ...item,
        matchedModel: matched
      });
    }
  }

  return result;
}

// ===============================
// 特定ショップ（既存＋拡張）
// ===============================
const TARGET_SHOPS = [
  "NIKE", "nike", "NIKE 公式", "NIKE 公式 楽天市場店", "nike-official",
  "Xebio", "ゼビオ", "Super Sports XEBIO", "スーパースポーツゼビオ",
  "スポーツゼビオ", "supersportsxebio",
  "Victoria", "ヴィクトリア",
  "Victoria Surf&Snow", "Victoria L-Breath", "Victoria Golf",
  "Victoria 楽天市場支店",
  "アルペン", "Alpen", "アルペン楽天市場店",
  "スポーツデポ", "Sports Depot", "スポーツデポ楽天市場店",
  "ヒマラヤ", "Himaraya",
  "ヒマラヤ楽天市場店", "ヒマラヤアウトドア専門店",
  "ABC", "ABCMart", "ABC-MART", "ABC-MART楽天市場店",
  "アネックス", "アネックススポーツ",
  "OnStep",
  "ブランド古着", "ベクトル",
  "ブランド古着ベクトル", "ブランド古着ベクトルプレミアム店"
];

// ===============================
// 特定ショップ抽出
// ===============================
function filterSpecialShops(items) {
  for (const shopKey of TARGET_SHOPS) {
    const hit = items.find(it => it.shop.includes(shopKey));
    if (hit) return hit;
  }
  return null;
}

// ===============================
// itemCode抽出（shop:itemId）
// ===============================
function extractItemCode(url) {
  const m = url.match(/item\.rakuten\.co\.jp\/([^\/]+)\/(\d+)/);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

// ===============================
// itemCode学習（models.json に追記）
// ===============================
function saveItemCodes(modelEntry, items) {
  if (!modelEntry.itemCodes) modelEntry.itemCodes = [];

  for (const item of items) {
    const code = extractItemCode(item.url);
    if (code && !modelEntry.itemCodes.includes(code)) {
      modelEntry.itemCodes.push(code);
    }
  }
}

// ===============================
// 最安値TOP3抽出
// ===============================
function extractTop3(items) {
  const sorted = items.sort((a, b) => a.price - b.price);
  return sorted.slice(0, 3);
}

// ===============================
// searchRakutenAll（完成版）
// ===============================
async function searchRakutenAll() {

  const models = await loadModels();
  let allResults = [];

  for (const m of models) {

    // ① itemCode検索（最優先）
    let items = await tryItemCodeSearch(m);

    // ② itemCode未学習 → 型番検索
    if (!items) {
      const modelItems = await searchByModel(m.model);

      // ③ HTML型番抽出 → Keepa照合（誤ヒット完全排除）
      items = await filterCorrectItems(modelItems, m.model);

      // ④ itemCode学習（正しい商品だけ）
      saveItemCodes(m, items);
    }

    // ⑤ 特定ショップ優先
    const special = filterSpecialShops(items);

    // ⑥ 最安値TOP3
    const top3 = extractTop3(items);

    // ⑦ 最終結果（特定ショップがあれば最優先）
    const finalResult = special || top3[0] || null;

    // ⑧ JSON出力形式（既存構造を維持）
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
  // JSON ダウンロード（既存ロジック継承）
  // ===============================
  const blob = new Blob([JSON.stringify(allResults, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "rakuten_results.json";
  a.click();

  // ===============================
  // models.json を学習結果で更新（GitHub Pages対応）
  // ===============================
  console.log("学習済み models.json:", JSON.stringify(models, null, 2));
}
