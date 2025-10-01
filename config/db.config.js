require("dotenv").config();

module.exports = {
  HOST: String(process.env.HOST),
  USER: String(process.env.USER),
  PASSWORD: String(process.env.PASSWORD),
  DB: String(process.env.DB),
  dialect: "postgres",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
    maxUses: 10000,
  },
};
