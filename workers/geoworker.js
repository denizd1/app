// workers/geoWorker.js
require("dotenv").config({ path: __dirname + "/../.env" });

const { Worker } = require("bullmq");
const db = require("../models");
const Tutorial = db.tutorials;

const citiesLatLongjson = require("../cities_of_turkey.json");
const utmObj = require("utm-latlng");
const centerofmass = require("@turf/center-of-mass");
const turflinestring = require("turf-linestring");
const {
  checkPointInPolygon,
  intersectionCheck,
  intersectionCheckLine,
} = require("../controllers/coordfinder.js"); // adjust path if needed
const { replaceVal } = require("../utils/excelhelpers");

const redisConnection = { connection: { host: "127.0.0.1", port: 6379 } };

function converter(x, y, zone, datum) {
  if (
    x !== null &&
    x !== undefined &&
    y !== null &&
    y !== undefined &&
    zone !== null &&
    zone !== undefined &&
    datum !== null &&
    datum !== undefined
  ) {
    let utm;
    if (datum === "WGS_84") utm = new utmObj("WGS 84");
    else if (datum === "ED_50") utm = new utmObj("ED50");
    else throw new Error("Datum bilgisini kontrol ediniz!");
    return utm.convertUtmToLatLng(x, y, zone, "N");
  }
  throw new Error("Koordinat bilgilerini kontrol ediniz.");
}

// Heavy enrichment, adapted from your original importData
async function enrichRow(row) {
  // zone parsing
  if (row.zone === null || row.zone === undefined) {
    throw new Error("Zone bilgisini kontrol ediniz!");
  }
  if (typeof row.zone === "string" && row.zone.includes(",")) {
    row.zone = row.zone.split(",").map((n) => Number(n));
  } else if (Array.isArray(row.zone)) {
    row.zone = row.zone.map((n) => Number(n));
  } else {
    row.zone = [parseInt(row.zone)];
  }
  row.zone = row.zone.map((z) => {
    if (z > 39 || z < 35) throw new Error("Zone bilgisini kontrol ediniz!");
    return z;
  });

  // x,y → lat/lon and pafta info
  if (row.x !== null && row.y !== null) {
    const latlon = converter(row.x, row.y, row.zone[0], row.datum);
    // NOTE: your original had lat=lng and lon=lat, preserving that:
    row.lat = latlon.lng;
    row.lon = latlon.lat;

    const check = checkPointInPolygon(row.lat, row.lon);
    row.besyuzbin = check.besyuz;
    row.yuzbin = check.yuz;
    row.yirmibesbin = check.yirmibes;
    row.il = check.il;
    row.ilce = check.ilce;
  } else if (row.il && row.x == null && row.y == null) {
    const dummyCity = row.il.includes(",")
      ? row.il.split(",")[0].trim()
      : row.il.trim();
    const thisCity = citiesLatLongjson.find((c) => c.il === dummyCity);
    if (!thisCity) throw new Error(`Şehir "${dummyCity}" bulunamadı.`);
    row.lat = parseFloat(thisCity.longitude);
    row.lon = parseFloat(thisCity.latitude);
  }

  // profil start/end line → intersections + midpoint
  if (
    row.profil_baslangic_x != null &&
    row.profil_baslangic_y != null &&
    row.profil_bitis_x != null &&
    row.profil_bitis_y != null
  ) {
    const s = converter(
      row.profil_baslangic_x,
      row.profil_baslangic_y,
      row.zone.length > 1 ? row.zone[0] : row.zone[0],
      row.datum
    );
    const e = converter(
      row.profil_bitis_x,
      row.profil_bitis_y,
      row.zone.length > 1 ? row.zone[1] : row.zone[0],
      row.datum
    );

    const line = turflinestring([
      [s.lng, s.lat],
      [e.lng, e.lat],
    ]);
    const chk = intersectionCheckLine(line);
    row.yirmibesbin = chk.yirmibes.join(", ");
    row.yuzbin = chk.yuz.join(", ");
    row.besyuzbin = chk.besyuz.join(", ");
    row.il = chk.il.join(", ");
    row.ilce = chk.ilce.join(", ");

    // Midpoint math (preserving your original formula/axes)
    if (typeof Number.prototype.toRad === "undefined") {
      Number.prototype.toRad = function () {
        return (this * Math.PI) / 180;
      };
    }
    if (typeof Number.prototype.toDeg === "undefined") {
      Number.prototype.toDeg = function () {
        return this * (180 / Math.PI);
      };
    }
    const dLng = (e.lng - s.lng).toRad();
    const lat1 = s.lat.toRad();
    const lat2 = e.lat.toRad();
    const lng1 = s.lng.toRad();
    const bX = Math.cos(lat2) * Math.cos(dLng);
    const bY = Math.cos(lat2) * Math.sin(dLng);
    const lat3 = Math.atan2(
      Math.sin(lat1) + Math.sin(lat2),
      Math.sqrt((Math.cos(lat1) + bX) * (Math.cos(lat1) + bX) + bY * bY)
    );
    const lng3 = lng1 + Math.atan2(bY, Math.cos(lat1) + bX);
    row.lat = lng3.toDeg();
    row.lon = lat3.toDeg();
  }

  // polygon (a_1..a_4) → intersections + center of mass
  if (row.a_1 && row.a_2 && row.a_3 && row.a_4) {
    const corners = [row.a_1, row.a_2, row.a_3, row.a_4];
    const coords = [];

    for (let i = 0; i < corners.length; i++) {
      const [xs, ys] = String(corners[i]).split(",");
      const x = parseFloat(xs),
        y = parseFloat(ys);
      const pt = converter(
        x,
        y,
        row.zone.length > 1 ? row.zone[i] : row.zone[0],
        row.datum
      );
      coords.push([pt.lng, pt.lat]);
    }

    const first = String(corners[0]).split(",");
    const close = converter(
      parseFloat(first[0]),
      parseFloat(first[1]),
      row.zone[0],
      row.datum
    );
    coords.push([parseFloat(close.lng), parseFloat(close.lat)]);

    const geoJson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { mytag: "datdat", name: "datdat", tessellate: true },
          geometry: { type: "Polygon", coordinates: [coords] },
        },
      ],
    };

    const chk = intersectionCheck(geoJson);
    row.yirmibesbin = chk.yirmibes.join(", ");
    row.yuzbin = chk.yuz.join(", ");
    row.besyuzbin = chk.besyuz.join(", ");
    row.il = chk.il.join(", ");
    row.ilce = chk.ilce.join(", ");

    const com = centerofmass.default(geoJson);
    row.lat = com.geometry.coordinates[0];
    row.lon = com.geometry.coordinates[1];
  }

  // calisma_tarihi coercion, same rules as your original
  if (typeof row.calisma_tarihi !== "string") {
    const regex = /^(181[2-9]|18[2-9]\d|19\d\d|2\d{3}|30[0-3]\d|304[0-8])$/;
    if (regex.test(row.calisma_tarihi)) {
      row.calisma_tarihi = row.calisma_tarihi.toString();
    } else {
      const d = row.calisma_tarihi;
      row.calisma_tarihi = `${d.getUTCDate()}/${
        d.getUTCMonth() + 1
      }/${d.getUTCFullYear()}`;
    }
  }

  // final normalize/replace, but skip pafta fields from stringification
  for (const [key, value] of Object.entries(row)) {
    if (["il", "ilce", "yuzbin", "besyuzbin", "yirmibesbin"].includes(key))
      continue;
    row[key] = replaceVal(value);
    row[key] = value !== null && value !== undefined ? String(value) : null;
    if (key === "lat" || key === "lon") {
      row[key] =
        value !== null && value !== undefined ? parseFloat(value) : null;
    }
  }

  // mark ready
  row.published = true;
  return row;
}

// Worker definition
const worker = new Worker(
  "geo-processing",
  async (job) => {
    console.log(`Starting geo job ${job.id}`);
    if (job.name !== "processRows") return;

    const { ids } = job.data;
    if (!Array.isArray(ids) || !ids.length) return;

    const rows = await Tutorial.findAll({ where: { id: ids } });

    for (const rec of rows) {
      const row = rec.get({ plain: true });

      try {
        const enriched = await enrichRow({ ...row });

        // ⚠️ Exclude fields that must not be updated
        const { id, createdAt, updatedAt, ...updatableFields } = enriched;

        console.log(
          `Updating record ${rec.id} with fields:`,
          Object.keys(updatableFields)
        );

        await Tutorial.update(updatableFields, { where: { id: rec.id } });
      } catch (err) {
        console.error(`Geo enrich failed for id=${rec.id}:`, err.message);
      }
    }
  },
  redisConnection
);

worker.on("completed", (job) => {
  console.log(`Geo job ${job.id} completed`);
});
worker.on("failed", (job, err) => {
  console.error(`Geo job ${job?.id} failed:`, err);
});
