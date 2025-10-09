// ==============================
// FILE: src/services/geo.service.js
// ==============================
const fs = require("fs");
const utmObj = require("utm-latlng");
const geojsonobj = require("geojson");
const turflinestring = require("turf-linestring");
const {
  checkPointInPolygon,
  intersectionCheck,
  intersectionCheckLine,
} = require("../controllers/coordfinder.js"); // path unchanged relative to original

// Load GeoJSONs once (same files as original)
const illergeojson = JSON.parse(fs.readFileSync("tr-cities-utf8.geojson"));
const ilceler = JSON.parse(fs.readFileSync("tr_ilce.geojson"));

function converter(x, y, zone, datum) {
  if (x == null || y == null || zone == null || datum == null) {
    throw new Error("Koordinat bilgilerini kontrol ediniz.");
  }
  let utm = null;
  if (datum === "WGS_84") utm = new utmObj("WGS 84");
  else if (datum === "ED_50") utm = new utmObj("ED50");
  else throw new Error("Datum bilgisini kontrol ediniz!");

  return utm.convertUtmToLatLng(x, y, zone, "N");
}

function findCityGeometryByName(il) {
  if (!il) return null;
  const ilArray = illergeojson.features.filter(
    (f) => f.properties.name.toLowerCase() === String(il).toLowerCase()
  );
  return ilArray && ilArray.length ? ilArray[0].geometry : null;
}

function findDistrictGeometryById(id) {
  if (id == null) return null;
  const ilceArray = ilceler.features.filter((f) => f.properties.Id == id);
  return ilceArray && ilceArray.length ? ilceArray[0].geometry : null;
}

// Parses `areaJson` behavior identical to original (number -> ilce Id, JSON string -> geometry)
function parseAreaJson(areaJson) {
  if (areaJson == null) return null;
  const reg = /^\d+$/;
  if (reg.test(areaJson)) {
    const g = findDistrictGeometryById(areaJson);
    return g ? { geometry: g } : null;
  }
  try {
    const parsed = JSON.parse(areaJson);
    return { geometry: parsed.geometry || parsed };
  } catch (e) {
    return null;
  }
}

// Build ST_Contains condition for Sequelize
function buildLocationCondition(sequelize, geometry) {
  if (!geometry) return null;
  return sequelize.where(
    sequelize.fn(
      "ST_Contains",
      sequelize.fn("ST_GeomFromGeoJSON", JSON.stringify(geometry)),
      sequelize.col("location")
    ),
    true
  );
}

// Extract full geo condition following original branching (il -> city polygon, areaJson, etc.)
function extractGeoConditionFromQuery(sequelize, query) {
  const Q = query || {};
  let geometry = null;

  // areaJson overrides if present
  if (Q.areaJson != null) {
    const areaObj = parseAreaJson(Q.areaJson);
    if (areaObj) geometry = areaObj.geometry;
  }

  // If no areaJson, try `il` as city match
  if (!geometry && Q.il) {
    const g = findCityGeometryByName(Q.il);
    if (g) geometry = g;
  }

  return buildLocationCondition(sequelize, geometry);
}

// Post-process rows to compute altYontemCounts, line coordinates, and geojson points
function postProcessPlotData(rows) {
  const altYontemCounts = {};

  rows.forEach((item) => {
    if (item.alt_yontem) {
      if (item.yontem === "Kuyu Ölçüleri") {
        const depthFields = [
          "derinlik_m_gr",
          "derinlik_m_neu",
          "derinlik_m_den",
          "derinlik_m_res",
          "derinlik_m_sp",
          "derinlik_m_cal",
          "derinlik_m_term",
          "derinlik_m_sgr",
          "derinlik_m_cbl",
          "derinlik_m_son",
          "derinlik_m_ccl",
        ];
        depthFields.forEach((field) => {
          if (item[field] && !isNaN(item[field])) {
            altYontemCounts[field] =
              (altYontemCounts[field] || 0) + parseFloat(item[field]);
          }
        });
      }
      altYontemCounts[item.alt_yontem] =
        (altYontemCounts[item.alt_yontem] || 0) + 1;
    }
  });

  // Build line coordinates if profil_* fields exist
  rows.forEach((item) => {
    if (
      item.profil_baslangic_x != null &&
      item.profil_baslangic_y != null &&
      item.profil_bitis_x != null &&
      item.profil_bitis_y != null
    ) {
      let utm = null;
      if (item.datum === "WGS_84") utm = new utmObj("WGS 84");
      else if (item.datum === "ED_50") utm = new utmObj("ED50");

      const lineStart = utm.convertUtmToLatLng(
        item.profil_baslangic_x,
        item.profil_baslangic_y,
        item.zone,
        "N"
      );
      const lineEnd = utm.convertUtmToLatLng(
        item.profil_bitis_x,
        item.profil_bitis_y,
        item.zone,
        "N"
      );
      item.line = [
        [lineStart.lat, lineStart.lng],
        [lineEnd.lat, lineEnd.lng],
      ];
    } else {
      item.line = null;
    }
  });

  // Prepare points + lines output
  const fieldsToPick = [
    "id",
    "yontem",
    "alt_yontem",
    "nokta_adi",
    "proje_kodu",
    "calisma_amaci",
    "calisma_tarihi",
    "x",
    "y",
    "profil_baslangic_x",
    "profil_baslangic_y",
    "profil_bitis_x",
    "profil_bitis_y",
    "zone",
    "line",
    "datum",
    "a_1",
    "a_2",
    "a_3",
    "a_4",
    "lat",
    "lon",
  ];
  const forPlot = rows.map((r) => {
    const out = {};
    fieldsToPick.forEach((k) => {
      if (k in r) out[k] = r[k];
    });
    return out;
  });

  const lines = forPlot.filter((p) => p.line != null);
  const resPoints = geojsonobj.parse(forPlot, { Point: ["lon", "lat"] });

  return { resPoints, resLines: lines, altYontemCounts };
}

// Update-specific helpers (same logic as original update)
function enrichUpdateBodyFromPoint(body) {
  if (body["x"] != null && body["y"] != null) {
    const check = checkPointInPolygon(body["lat"], body["lon"]);
    body["besyuzbin"] = check.besyuz;
    body["yuzbin"] = check.yuz;
    body["yirmibesbin"] = check.yirmibes;
    body["il"] = check.il;
    body["ilce"] = check.ilce;
  }
}

function enrichUpdateBodyFromLine(body) {
  if (
    body["profil_baslangic_x"] != null &&
    body["profil_baslangic_y"] != null &&
    body["profil_bitis_x"] != null &&
    body["profil_bitis_y"] != null
  ) {
    const polyLineStart = converter(
      body["profil_baslangic_x"],
      body["profil_baslangic_y"],
      body["zone"].length > 1 ? body["zone"][0] : body["zone"][0],
      body["datum"]
    );
    const polyLineEnd = converter(
      body["profil_bitis_x"],
      body["profil_bitis_y"],
      body["zone"].length > 1 ? body["zone"][1] : body["zone"][0],
      body["datum"]
    );
    const line = turflinestring([
      [polyLineStart.lng, polyLineStart.lat],
      [polyLineEnd.lng, polyLineEnd.lat],
    ]);
    const check = intersectionCheckLine(line);
    body["yirmibesbin"] = check.yirmibes.join(", ");
    body["yuzbin"] = check.yuz.join(", ");
    body["besyuzbin"] = check.besyuz.join(", ");
    body["il"] = check.il.join(", ");
    body["ilce"] = check.ilce.join(", ");
  }
}

function enrichUpdateBodyFromPolygonCorners(body) {
  if (
    body["a_1"] != null &&
    body["a_2"] != null &&
    body["a_3"] != null &&
    body["a_4"] != null
  ) {
    const corners = [body["a_1"], body["a_2"], body["a_3"], body["a_4"]];
    const coordinates = [];
    for (let i = 0; i < corners.length; i++) {
      const [xStr, yStr] = String(corners[i]).split(",");
      const x = parseFloat(xStr);
      const y = parseFloat(yStr);
      const cornerPoint = converter(
        x,
        y,
        body["zone"].length > 1 ? body["zone"][i] : body["zone"][0],
        body["datum"]
      );
      coordinates.push([cornerPoint.lng, cornerPoint.lat]);
    }
    const close = converter(
      parseFloat(String(corners[0]).split(",")[0]),
      parseFloat(String(corners[0]).split(",")[1]),
      body["zone"].length > 1 ? body["zone"][0] : body["zone"][0],
      body["datum"]
    );
    coordinates.push([parseFloat(close.lng), parseFloat(close.lat)]);

    const geoJson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { mytag: "datdat", name: "datdat", tessellate: true },
          geometry: { type: "Polygon", coordinates: [coordinates] },
        },
      ],
    };
    const check = intersectionCheck(geoJson);
    body["yirmibesbin"] = check.yirmibes.join(", ");
    body["yuzbin"] = check.yuz.join(", ");
    body["besyuzbin"] = check.besyuz.join(", ");
    body["il"] = check.il.join(", ");
    body["ilce"] = check.ilce.join(", ");
  }
}

module.exports = {
  converter,
  findCityGeometryByName,
  findDistrictGeometryById,
  parseAreaJson,
  buildLocationCondition,
  extractGeoConditionFromQuery,
  postProcessPlotData,
  enrichUpdateBodyFromPoint,
  enrichUpdateBodyFromLine,
  enrichUpdateBodyFromPolygonCorners,
};
