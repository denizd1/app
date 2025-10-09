// ==============================
// FILE: src/controllers/tutorial.controller.js
// ==============================
const db2 = require("../models");
const Tutorial = db2.tutorials;
const Sequelize2 = db2.Sequelize;
const { getPagination, getPagingData } = require("../utils/pagination");
const { buildFilters } = require("../utils/filterBuilder");
const tutorialService = require("../services/tutorial.service");
const geo = require("../services/geo.service");

// GET /tutorials
exports.findAll = async (req, res) => {
  try {
    const { page, size } = req.query;
    const pagination = getPagination(page, size);
    const data = await tutorialService.findAll(
      req.query,
      pagination,
      Tutorial.sequelize
    );
    res.send(getPagingData(data, page, pagination.limit));
  } catch (err) {
    console.log(err);
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving tutorials.",
    });
  }
};

// GET /tutorials/getall (geojson + lines + counts OR excel)
exports.findAllgetAll = async (req, res) => {
  try {
    const { requestFlag } = req.query;

    if (requestFlag === "excel") {
      return tutorialService.streamExcel(req.query, Tutorial.sequelize, res);
    }

    const rows = await tutorialService.findAllRaw(
      req.query,
      Tutorial.sequelize
    );
    const processed = geo.postProcessPlotData(rows);
    res.send(processed);
  } catch (err) {
    console.log(err);
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving tutorials.",
    });
  }
};

// GET /tutorials/geo (accepts geojson or ilce id) (and excel)
exports.findAllGeo = async (req, res) => {
  try {
    const { geojson, yontem, requestFlag } = req.query;

    // Build polygon ST_Contains identical to original behavior
    let polygonCondition = null;
    if (geojson) {
      const ilceGeom = geo.findDistrictGeometryById(geojson);
      let geometry = null;

      if (ilceGeom) {
        geometry = ilceGeom;
      } else {
        try {
          const coords = JSON.parse(geojson); // expect [[lon,lat],...]
          geometry = { type: "Polygon", coordinates: [coords] };
        } catch {
          console.warn("Invalid geojson format in query");
          geometry = null;
        }
      }

      if (geometry)
        polygonCondition = geo.buildLocationCondition(
          Tutorial.sequelize,
          geometry
        );
    }

    if (requestFlag === "excel") {
      return tutorialService.streamExcel(
        req.query,
        Tutorial.sequelize,
        res,
        polygonCondition
      );
    }

    const rows = await tutorialService.findAllGeo(
      req.query,
      Tutorial.sequelize,
      polygonCondition
    );
    const processed = geo.postProcessPlotData(rows);
    res.send(processed);
  } catch (err) {
    console.log(err);
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving tutorials.",
    });
  }
};

// GET /tutorials/:id
exports.findOne = async (req, res) => {
  try {
    const id = req.autosan ? req.autosan.params.id : req.params.id; // preserve autosan path
    const data = await tutorialService.findOne(id);
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message:
        "Error retrieving Tutorial with id=" +
        (req.autosan ? req.autosan.params.id : req.params.id),
    });
  }
};

// PUT /tutorials/:id
exports.update = async (req, res) => {
  try {
    const id = req.autosan ? req.autosan.params.id : req.params.id;
    const num = await tutorialService.update(id, req.body);
    if (num == 1 || (Array.isArray(num) && num[0] == 1)) {
      res.send({ message: "Tutorial was updated successfully." });
    } else {
      res.send({
        message: `Cannot update Tutorial with id=${id}. Maybe Tutorial was not found or req.body is empty!`,
      });
    }
  } catch (err) {
    res.status(500).send({
      message:
        "Error updating Tutorial with id=" +
        (req.autosan ? req.autosan.params.id : req.params.id),
    });
  }
};

// DELETE /tutorials/:id
exports.delete = async (req, res) => {
  try {
    const id = req.params.id;
    const num = await tutorialService.remove(id);
    if (num == 1) res.send({ message: "Tutorial was deleted successfully!" });
    else
      res.send({
        message: `Cannot delete Tutorial with id=${id}. Maybe Tutorial was not found!`,
      });
  } catch (err) {
    res
      .status(500)
      .send({ message: "Could not delete Tutorial with id=" + req.params.id });
  }
};

// GET /tutorials/distinct?column=[a,b,...]&...(filters)
exports.distinct = async (req, res) => {
  try {
    const columns = req.query.column;
    if (!columns || !Array.isArray(columns))
      return res
        .status(400)
        .send({ message: "column query param must be array" });

    // Build location condition for il / ilce / geojson like original distinct()
    let locationCondition = null;
    if (req.query.il) {
      const g = geo.findCityGeometryByName(req.query.il);
      if (g)
        locationCondition = geo.buildLocationCondition(Tutorial.sequelize, g);
    }
    if (req.query.ilce) {
      const g = geo.findDistrictGeometryById(req.query.ilce);
      if (g)
        locationCondition = geo.buildLocationCondition(Tutorial.sequelize, g);
    }
    if (req.query.geojson) {
      const geometry = {
        type: "Polygon",
        coordinates: [[JSON.parse(`[${req.query.geojson}]`)]],
      };
      locationCondition = geo.buildLocationCondition(
        Tutorial.sequelize,
        geometry
      );
    }

    const where = buildFilters(req.query, locationCondition);
    const payload = await tutorialService.distinct(columns, where);
    res.send(payload);
  } catch (err) {
    res.status(500).send({ message: "Could find distinct values" });
  }
};

// GET /tutorials/published
exports.findAllPublished = async (req, res) => {
  try {
    const { page, size } = req.query;
    const { limit, offset } = getPagination(page, size);
    const data = await Tutorial.findAndCountAll({
      where: { published: true },
      limit,
      offset,
    });
    res.send(getPagingData(data, page, limit));
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving tutorials.",
    });
  }
};

// GET /tutorials/unpublished
exports.findAllUnpublished = async (req, res) => {
  try {
    const { page, size } = req.query;
    const { limit, offset } = getPagination(page, size);
    const data = await Tutorial.findAndCountAll({
      where: { published: false },
      limit,
      offset,
    });
    res.send(getPagingData(data, page, limit));
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving tutorials.",
    });
  }
};

// GET /tutorials/alt-yontem-count
exports.AltYontemCount = async (req, res) => {
  try {
    const data = await tutorialService.countByAltYontem();
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving tutorials.",
    });
  }
};
