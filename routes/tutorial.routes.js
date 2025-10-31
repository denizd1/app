module.exports = (app) => {
  const { authJwt } = require("../middleware");

  const tutorials = require("../controllers/tutorial.controller.js");
  const expAutoSan = require("express-autosanitizer");
  const excelController = require("../controllers/excel.controller.js");
  const upload = require("../middleware/upload");

  var router = require("express").Router();
  // app.use(function (req, res, next) {
  //   res.header(
  //     "Access-Control-Allow-Headers",
  //     "x-access-token, Origin, Content-Type, Accept"
  //   );
  //   next();
  // });
  //get distinct
  router.get("/distinct", [authJwt.verifyToken], tutorials.distinct);
  //  router.get(
  //     "/files",
  //     [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
  //     excelController.getListFiles
  //   );
  // Create a new Tutorial
  router.post(
    "/upload",
    [authJwt.verifyToken, authJwt.isModeratorOrAdmin, upload.single("file")],

    excelController.upload
  );

  //get number of tutorials for each alt_yontem
  router.get(
    "/AltYontemCount",
    [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
    tutorials.AltYontemCount
  );

  // Retrieve all Tutorials
  router.get("/", [authJwt.verifyToken], tutorials.findAll);
  router.get("/getall", [authJwt.verifyToken], tutorials.findAllgetAll);

  // Retrieve all Tutorials in geojson
  router.get("/findAllGeo", [authJwt.verifyToken], tutorials.findAllGeo);

  // Retrieve all published Tutorials
  router.get("/published", [authJwt.verifyToken], tutorials.findAllPublished);

  //Retrieve all unpublished Tutorials
  router.get(
    "/unpublished",
    [authJwt.verifyToken, authJwt.isAdmin],
    tutorials.findAllUnpublished
  );

  // Retrieve a single Tutorial with id
  router.get(
    "/:id",
    [authJwt.verifyToken],
    expAutoSan.route,
    tutorials.findOne
  );
  // Update a Tutorial with id
  router.put(
    "/:id",
    [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
    expAutoSan.route,
    tutorials.update
  );

  // Delete a Tutorial with id
  router.delete(
    "/:id",
    [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
    tutorials.delete
  );
  // routes/tutoral.routes.js
  router.post(
    "/bulk-delete",
    [authJwt.verifyToken, authJwt.isModeratorOrAdmin],
    tutorials.bulkDelete
  );

  // Delete all Tutorials
  // router.delete("/", tutorials.deleteAll);

  app.use("/api/tutorials", router);
};
