module.exports = (sequelize, Sequelize) => {
  const ProjectMethod = sequelize.define(
    "project_methods",
    {
      proje_kodu: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      yil: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      kullanilan_yontemler: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      proje_adi: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    },
    {
      charset: "utf8",
      collate: "utf8_unicode_ci",
      timestamps: false,
    },
  );

  return ProjectMethod;
};
