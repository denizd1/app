// ==============================
// FILE: src/utils/filterBuilder.js
// ==============================
const { Op } = require("sequelize");

// Helper: normalize a value to array (if present)
const asArrayIfPresent = (v) => (v == null ? null : Array.isArray(v) ? v : [v]);

// Builds a Sequelize-compatible `where` array preserving the original behavior
function buildFilters(query, locationCondition) {
  const Q = query || {};
  const filters = [];
  const add = (cond) => cond && filters.push(cond);

  // 1) Geo condition (ST_Contains)
  add(locationCondition || null);

  // 2) Text filters (case-insensitive)
  if (Q.ilce) add({ ilce: { [Op.iLike]: `%${Q.ilce}%` } });

  const yontem = asArrayIfPresent(Q.yontem);
  const alt_yontem = asArrayIfPresent(Q.alt_yontem);

  if (yontem) {
    add({
      [Op.or]: [
        { yontem: { [Op.or]: yontem } },
        { alt_yontem: { [Op.or]: yontem } },
      ],
    });
  }
  if (alt_yontem) {
    add({
      [Op.or]: [
        { yontem: { [Op.or]: alt_yontem } },
        { alt_yontem: { [Op.or]: alt_yontem } },
      ],
    });
  }

  // calisma_amaci (string | array)
  if (Q.calisma_amaci != null) {
    if (Array.isArray(Q.calisma_amaci)) {
      add({ calisma_amaci: { [Op.or]: Q.calisma_amaci } });
    } else {
      add({ calisma_amaci: { [Op.iLike]: `%${Q.calisma_amaci}%` } });
    }
  }

  // calisma_tarihi (string | array) -> iRegexp list like original
  if (Q.calisma_tarihi != null) {
    if (Array.isArray(Q.calisma_tarihi)) {
      add({
        calisma_tarihi: {
          [Op.or]: Q.calisma_tarihi.map((v) => ({ [Op.iRegexp]: `.*${v}.*` })),
        },
      });
    } else {
      add({ calisma_tarihi: { [Op.iRegexp]: `.*${Q.calisma_tarihi}.*` } });
    }
  }

  // Common list-like filters
  const listLike = [
    "proje_kodu",
    "kuyu_arsiv_no",
    "jeofizik_arsiv_no",
    "derleme_no",
    "cd_no",
  ];
  for (const key of listLike) {
    const val = Q[key];
    if (val != null) {
      if (Array.isArray(val)) add({ [key]: { [Op.or]: val } });
      else add({ [key]: { [Op.iLike]: `%${val}%` } });
    }
  }

  // userStatus behavior (published gating)
  if (Q.userStatus === "user") add({ published: true });
  else add({ published: { [Op.or]: [true, false] } });

  // Special: requestFlag === userSearch -> OR across many fields on `il` value (as before)
  if (Q.requestFlag === "userSearch" && Q.il) {
    const searchFields = [
      "nokta_adi",
      "calisma_amaci",
      "il",
      "ilce",
      "yontem",
      "alt_yontem",
      "yuzbin",
      "yirmibesbin",
      "besyuzbin",
      "proje_kodu",
    ];
    add({
      [Op.or]: Object.fromEntries(
        searchFields.map((f) => [f, { [Op.iLike]: `%${Q.il}%` }])
      ),
    });
  } else {
    // Fallback: if no area filter is in play and `il` is provided
    if (!locationCondition && Q.il) add({ il: { [Op.iLike]: `%${Q.il}%` } });
  }

  return filters.length ? filters : null;
}

module.exports = { buildFilters };
