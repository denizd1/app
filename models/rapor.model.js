module.exports = (sequelize, Sequelize) => {
  const Report = sequelize.define(
    "reports",
    {
      proje_kodu: {
        type: Sequelize.STRING,
        allowNull: false, // Bağlantı anahtarı olduğu için boş olmamalı
      },
      rapor_adi: {
        type: Sequelize.TEXT,
      },
      yazarlar: {
        type: Sequelize.TEXT,
      },
      il: {
        type: Sequelize.STRING,
      },
      ilce: {
        type: Sequelize.STRING,
      },
      calisma_yili: {
        // Excel'deki "ÇALIŞMA VEYA RAPOR YILI"
        type: Sequelize.STRING,
      },
      kullanilan_yontemler: {
        // İkinci excelde de var, istersen alabilirsin
        type: Sequelize.TEXT,
      },
    },
    {
      timestamps: false,
      charset: "utf8",
      collate: "utf8_unicode_ci",
    },
  );

  return Report;
};
