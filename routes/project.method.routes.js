module.exports = (app) => {
  const { authJwt } = require("../middleware");
  const projectMethodController = require("../controllers/project.method.controller.js");

  var router = require("express").Router();
  // get all project methods
  router.get(
    "/",
    [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
    projectMethodController.findAll,
  );
  // get unique values from each column
  router.get(
    "/unique-values",
    [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
    projectMethodController.getUniqueValues,
  );
  app.use("/api/project-methods", router);
};
