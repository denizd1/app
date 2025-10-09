// ==============================
// FILE: src/services/tutorial.service.js
// ==============================
const db = require("../models");
const Tutorial = db.tutorials;
const Sequelize = db.Sequelize;
const { buildFilters } = require("../utils/filterBuilder");
const geo = require("./geo.service");
const excel = require("./excel.service");

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
  // polygonCondition is already built by controller for /findAllGeo path
  const where = buildFilters(query, polygonCondition);
  console.log(where);
  return Tutorial.findAll({ where });
}

async function streamExcel(query, sequelize, res, polygonCondition = null) {
  const where = buildFilters(
    query,
    polygonCondition || geo.extractGeoConditionFromQuery(sequelize, query)
  );
  return excel.streamExcelFromQuery(Tutorial, where, res);
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
