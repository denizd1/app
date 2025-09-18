module.exports = (app) => {
  const { authJwt } = require("../middleware");
  const raporController = require("../controllers/rapor.controller.js");

  var router = require("express").Router();

  // get all rapor
  router.get(
    "/",
    [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
    raporController.findAll
  );
  // get unique values from each column
  router.get(
    "/unique-values",
    [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
    raporController.getUniqueValues
  );
  // get rapor by id
  router.get(
    "/:id",
    [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
    raporController.findOne
  );

  app.use("/api/rapor", router);
};
