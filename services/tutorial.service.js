// ==============================
// FILE: src/services/tutorial.service.js
// ==============================
const { Op } = require("sequelize");

const db = require("../models");
const Tutorial = db.tutorials;
const Sequelize = db.Sequelize;
const { buildFilters } = require("../utils/filterBuilder");
const excel = require("./excel.service");

const geo = require("./geo.service");

async function findAll(query, pagination, sequelize) {
  const locationCondition = geo.extractGeoConditionFromQuery(sequelize, query);
  const where = buildFilters(query, locationCondition);
  return Tutorial.findAndCountAll({
    where,
    limit: pagination.limit,
    offset: pagination.offset,
  });
}

async function findAllRaw(query, sequelize) {
  const locationCondition = geo.extractGeoConditionFromQuery(sequelize, query);
  const where = buildFilters(query, locationCondition);
  return Tutorial.findAll({ where });
}

async function findAllGeo(query, sequelize, polygonCondition) {
  const where = buildFilters(query, polygonCondition);
  return Tutorial.findAll({ where });
}

async function streamExcel(query, sequelize, res, polygonCondition = null) {
  try {
    console.log("🟢 Excel export triggered for /getall");

    // Eğer polygonCondition verilmemişse, geojson'u elle parse et
    if (!polygonCondition && query.geojson) {
      try {
        const coords = Array.isArray(query.geojson)
          ? query.geojson
              .map((c) => {
                try {
                  const arr = JSON.parse(c);
                  return Array.isArray(arr) ? arr.map(Number) : null;
                } catch {
                  const parts = c.replace(/[\[\]]/g, "").split(",");
                  return parts.length === 2
                    ? [parseFloat(parts[0]), parseFloat(parts[1])]
                    : null;
                }
              })
              .filter(Boolean)
          : [];

        if (coords.length > 2) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1])
            coords.push([...first]);
          const geometry = { type: "Polygon", coordinates: [coords] };
          polygonCondition = geo.buildLocationCondition(sequelize, geometry);
          console.log("✅ Polygon condition successfully built.");
        }
      } catch (e) {
        console.warn("⚠️ Polygon parse failed:", e);
      }
    }

    console.log(
      "📦 streamExcel() triggered with polygonCondition:",
      !!polygonCondition
    );

    // ✅ WHERE filtresini kur
    const whereArray = buildFilters(
      query,
      polygonCondition || geo.extractGeoConditionFromQuery(sequelize, query)
    );

    const where =
      Array.isArray(whereArray) && whereArray.length
        ? { [Op.and]: whereArray }
        : {};

    console.log(
      "🧩 Final WHERE built for Excel export:",
      JSON.stringify(where, null, 2)
    );

    // ✅ Veriyi getir
    const rows = await Tutorial.findAll({
      raw: true,
      where,
      attributes: {
        exclude: [
          "id",
          "createdAt",
          "updatedAt",
          "editorname",
          "published",
          "lat",
          "lon",
        ],
      },
    });

    console.log(`✅ ${rows.length} rows fetched for Excel export.`);

    // ✅ Excel export
    return excel.streamExcelFromQuery(Tutorial, rows, res);
  } catch (err) {
    console.error("streamExcel() error:", err);
    if (!res.headersSent)
      res.status(500).send("Excel export error in tutorial.service.js");
  }
}

async function findOne(id) {
  return Tutorial.findByPk(id);
}

async function update(id, body) {
  const fields = Object.keys(body).filter((k) => k !== "id");

  geo.enrichUpdateBodyFromPoint(body);
  geo.enrichUpdateBodyFromLine(body);
  geo.enrichUpdateBodyFromPolygonCorners(body);

  const num = await Tutorial.update(body, { where: { id }, fields });
  return num;
}

async function remove(id) {
  return Tutorial.destroy({ where: { id } });
}

async function distinct(columns, where) {
  const out = {};
  await Promise.all(
    columns.map(async (column) => {
      const results = await Tutorial.findAll({
        attributes: [
          [
            Tutorial.sequelize.fn("DISTINCT", Tutorial.sequelize.col(column)),
            column,
          ],
        ],
        where,
        raw: true,
      });
      out[column] = results.map((r) => r[column]);
    })
  );
  return out;
}

async function countByAltYontem() {
  return Tutorial.count({
    group: "alt_yontem",
    attributes: [
      "alt_yontem",
      [Sequelize.fn("COUNT", Sequelize.col("alt_yontem")), "numberof"],
    ],
  });
}

module.exports = {
  findAll,
  findAllRaw,
  findAllGeo,
  streamExcel,
  findOne,
  update,
  remove,
  distinct,
  countByAltYontem,
};
