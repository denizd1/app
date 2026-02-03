const config = require("../config/db.config.js");

const Sequelize = require("sequelize");

const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
  host: config.HOST,
  dialect: config.dialect,
  operatorsAliases: false,

  pool: {
    max: config.pool.max,
    min: config.pool.min,
    acquire: config.pool.acquire,
    idle: config.pool.idle,
  },

  define: {
    charset: "utf8",
    collate: "utf8_general_ci",
    timestamps: true,
  },
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = require("../models/user.model.js")(sequelize, Sequelize);
db.tutorials = require("../models/tutorial.model.js")(sequelize, Sequelize);
db.role = require("../models/role.model.js")(sequelize, Sequelize);
db.rapor = require("../models/rapor.model.js")(sequelize, Sequelize);
db.projectMethod = require("../models/project.method.model.js")(
  sequelize,
  Sequelize,
);
db.refreshToken = require("../models/refreshToken.model.js")(
  sequelize,
  Sequelize,
);

// İLİŞKİ TANIMI (JOIN MANTIĞI)
// Bir projenin birden fazla raporu olabilir (HasMany)
db.projectMethod.hasMany(db.rapor, {
  foreignKey: "proje_kodu", // Reports tablosundaki bağlantı kolonu
  sourceKey: "proje_kodu", // ProjectMethods tablosundaki referans kolonu
  as: "reports", // Sorguda bu isimle gelecek
});

// Bir rapor bir projeye aittir (BelongsTo)
db.rapor.belongsTo(db.projectMethod, {
  foreignKey: "proje_kodu",
  targetKey: "proje_kodu",
  as: "project",
});

db.role.belongsToMany(db.user, {
  through: "user_roles",
  foreignKey: "roleId",
  otherKey: "userId",
});

db.user.belongsToMany(db.role, {
  through: "user_roles",
  foreignKey: "userId",
  otherKey: "roleId",
});

db.refreshToken.belongsTo(db.user, {
  foreignKey: "userId",
  targetKey: "id",
});
db.user.hasOne(db.refreshToken, {
  foreignKey: "userId",
  targetKey: "id",
});

db.ROLES = ["user", "admin", "moderator", "guest"];

module.exports = db;
