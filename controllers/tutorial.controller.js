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
  console.log("findAllgetAll called with params:", req.query);
  try {
    const { geojson, requestFlag } = req.query;
    let polygonCondition = null;

    // ✅ geojson varsa: ID ya da koordinat olabilir
    if (geojson) {
      let geometry = null;

      // 🔹 Eğer ID ise (ör. "1219" ya da 1219)
      if (/^\d+$/.test(geojson)) {
        const g = geo.findDistrictGeometryById(geojson);
        if (g) {
          geometry = g;
          console.log("📍 Geometry found by ID:", geojson);
        } else {
          console.warn("⚠️ No geometry found for district ID:", geojson);
        }
      }
      // 🔹 Dizi veya string koordinatlar
      else if (Array.isArray(geojson) && typeof geojson[0] === "string") {
        const numericCoords = geojson
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
          .filter(Boolean);

        const first = numericCoords[0];
        const last = numericCoords[numericCoords.length - 1];
        if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
          numericCoords.push([...first]);
        }

        geometry = { type: "Polygon", coordinates: [numericCoords] };
        console.log("📐 Geometry built from coordinate array.");
      }
      // 🔹 Full GeoJSON string veya objesi
      else if (typeof geojson === "string") {
        try {
          const parsed = JSON.parse(geojson);
          if (parsed.type === "Polygon") {
            geometry = parsed;
            console.log("📐 Geometry parsed from Polygon JSON.");
          } else if (Array.isArray(parsed)) {
            geometry = { type: "Polygon", coordinates: [parsed] };
            console.log("📐 Geometry parsed from array JSON.");
          }
        } catch {
          console.warn("⚠️ Invalid geojson string, skipping parse.");
        }
      }

      // ✅ Sequelize spatial filtreyi oluştur
      if (geometry) {
        polygonCondition = geo.buildLocationCondition(
          Tutorial.sequelize,
          geometry
        );
        console.log("✅ Polygon condition built for /getall.");
      }
    }

    // ✅ Excel export (stream)
    if (requestFlag === "excel") {
      console.log("🟢 Excel export triggered for /getall");
      return tutorialService.streamExcel(
        req.query,
        Tutorial.sequelize,
        res,
        polygonCondition
      );
    }

    // ✅ Normal sorgu
    const rows = await tutorialService.findAllRaw(
      req.query,
      Tutorial.sequelize,
      polygonCondition
    );

    if (rows.length > 200000) {
      console.log(`Streaming ${rows.length} records...`);
      return geo.streamPlotData(rows, res);
    } else if (rows.length > 50000) {
      console.log(`Using Lite mode for ${rows.length} records...`);
      const processed = geo.postProcessPlotDataLite(rows);
      return res.send(processed);
    }

    console.log(`Standard mode (${rows.length} records)`);
    const processed = geo.postProcessPlotData(rows);
    res.send(processed);
  } catch (err) {
    console.error("Error in findAllgetAll:", err);
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving tutorials.",
    });
  }
};

// GET /tutorials/geo (accepts geojson or ilce id) (and excel)
exports.findAllGeo = async (req, res) => {
  console.log("findAllGeo called with params:", req.query);
  try {
    const { geojson, requestFlag } = req.query;
    let polygonCondition = null;

    if (geojson) {
      let geometry = null;

      // 🧭 Case 1: geojson is an array of coordinate strings
      if (Array.isArray(geojson)) {
        try {
          const coords = geojson.map((c) => {
            if (typeof c === "string") {
              const clean = c.replace(/[\[\]\s]/g, "");
              const parts = clean.split(",").map(Number);
              return [parts[0], parts[1]];
            }
            return c;
          });

          // ilk ve son nokta kapanmamışsa kapat
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
            coords.push([...first]);
          }

          geometry = { type: "Polygon", coordinates: [coords] };
          console.log("✅ Geometry built from coordinate array.");
        } catch (err) {
          console.warn("⚠️ Failed to parse coordinate array:", err.message);
        }
      }

      // 🧭 Case 2: geojson is a string (id or GeoJSON)
      else if (typeof geojson === "string") {
        const parsed = geo.parseAreaJson(geojson);
        if (parsed && parsed.geometry) {
          geometry = parsed.geometry;
          console.log("✅ Geometry parsed via geo.parseAreaJson().");
        } else {
          console.warn("⚠️ Could not parse geojson string:", geojson);
        }
      }

      // 🔧 Build polygon condition
      if (geometry) {
        polygonCondition = geo.buildLocationCondition(
          Tutorial.sequelize,
          geometry
        );
      } else {
        console.warn("⚠️ No valid geometry found, skipping spatial filter.");
      }
    }

    // 🟡 Excel export mode
    if (requestFlag === "excel") {
      console.log(
        "🟡 Excel export triggered with polygonCondition:",
        !!polygonCondition
      );
      return tutorialService.streamExcel(
        req.query,
        Tutorial.sequelize,
        res,
        polygonCondition
      );
    }

    // 📦 Normal data retrieval
    const rows = await tutorialService.findAllGeo(
      req.query,
      Tutorial.sequelize,
      polygonCondition
    );

    if (rows.length > 50000) {
      const processed = geo.postProcessPlotDataLite(rows);
      return res.send(processed);
    }

    const processed = geo.postProcessPlotData(rows);
    res.send(processed);
  } catch (err) {
    console.error("❌ Error in findAllGeo:", err);
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
exports.bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || !ids.length)
      return res.status(400).send({ message: "Silinecek ID listesi boş." });

    const deleted = await Tutorial.destroy({
      where: { id: ids },
    });

    res.send({ message: `${deleted} kayıt silindi.` });
  } catch (err) {
    console.error("Toplu silme hatası:", err);
    res.status(500).send({
      message: err.message || "Toplu silme işlemi başarısız.",
    });
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
