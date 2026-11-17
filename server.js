require("dotenv").config();

require("v8-compile-cache");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
global.__basedir = __dirname + "/..";

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const db = require(__dirname + "/models");
const fs = require("fs");

const path = __dirname + "/views/";
const app = express();
const Role = db.role;

const csrf = require("csurf");
// The CSRF secret is kept in a cookie instead of an in-memory session. PM2 runs
// several copies of this server (cluster mode) and each copy has its own memory,
// so a session-based secret created by one copy is unknown to the others and
// POST/PUT/DELETE requests would fail with "invalid csrf token".
const csrfProtection = csrf({
  cookie: { httpOnly: true, sameSite: "strict" },
});

app.use(compression()); //Compress all routes

// var whitelist = ["http://0.0.0.0:8081"];
// var corsOptions = {
//   origin: function (origin, callback) {
//     var originIsWhitelisted = whitelist.indexOf(origin) !== -1;
//     callback(null, originIsWhitelisted);
//   },
//   credentials: true,
// };
app.use(cors());
// Bull Board (queue dashboard). Mounted before the CSRF middleware, so its
// routes are not CSRF protected.
const { serverAdapter } = require("./dashboard/bullboard");
app.use("/admin/queues", serverAdapter.getRouter());

//Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(limiter);
app.use(express.static(path));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(csrfProtection);

// Multi-core scaling is done by PM2 cluster mode (see ecosystem.config.js):
// PM2 starts several copies of this file and shares the port between them,
// so every copy registers all routes and listens.
app.get("/api/getcsrftoken", function (req, res) {
  return res.json({ csrfToken: req.csrfToken() });
});
require(__dirname + "/routes/tutorial.routes")(app);
require(__dirname + "/routes/auth.routes")(app);
require(__dirname + "/routes/user.routes")(app);
require(__dirname + "/routes/rapor.routes")(app);
require(__dirname + "/routes/project.method.routes")(app);
const excelRoutes = require(__dirname + "/routes/excel.routes");
app.use("/excel", excelRoutes);

app.get("/", function (req, res) {
  res.sendFile(path + "index.html");
});

app.get("/api/getGeoJson:val", function (req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  val = req.params.val;
  if (val == 0) {
    fs.createReadStream(__dirname + "/tr-cities-utf8.geojson").pipe(res);
  }
  if (val == 1) {
    fs.createReadStream(__dirname + "/tr_ilce.geojson").pipe(res);
  }
  if (val == 2) {
    fs.createReadStream(__dirname + "/gem_active_faults.geojson").pipe(res);
  }
  if (val == 25) {
    fs.createReadStream(__dirname + "/pafta25000.geojson").pipe(res);
  }

  if (val == 100) {
    fs.createReadStream(__dirname + "/pafta100000.geojson").pipe(res);
  }
  if (val == 500) {
    fs.createReadStream(__dirname + "/pafta500000.geojson").pipe(res);
  }
});

// PM2 gives every copy a NODE_APP_INSTANCE number (0, 1, 2, ...). Only the
// first copy syncs the schema so the copies don't run the same DDL at once.
// When started with plain `node server.js` the variable is not set.
const instance = process.env.NODE_APP_INSTANCE;
if (instance === undefined || instance === "0") {
  db.sequelize.sync();
  // db.sequelize.sync({force: true}).then(() => {
  //   console.log('Drop and Resync Database with { force: true }');
  //   initial();
  // });
}

// set port, listen for requests
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

function initial() {
  Role.create({
    id: 1,
    name: "user",
  });

  Role.create({
    id: 2,
    name: "moderator",
  });

  Role.create({
    id: 3,
    name: "admin",
  });
  Role.create({
    id: 4,
    name: "guest",
  });
}
