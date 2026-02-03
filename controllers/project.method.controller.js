const db = require("../models");
const ProjectMethod = db.projectMethod;
const Report = db.rapor;
const Op = db.Sequelize.Op;
const { getPagination, getPagingData } = require("../utils/pagination");
function toArrayOrUndefined(param) {
  if (!param) return undefined;
  return param
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}
//get all project methods
exports.findAll = (req, res) => {
  const { page, size, proje_kodu, yil, kullanilan_yontemler, proje_adi } =
    req.query;
  const { limit, offset } = getPagination(page, size);
  let condition = {};
  const multiFields = {
    proje_kodu: toArrayOrUndefined(proje_kodu),
    yil: toArrayOrUndefined(yil),
    kullanilan_yontemler: toArrayOrUndefined(kullanilan_yontemler),
    proje_adi: toArrayOrUndefined(proje_adi),
  };
  for (const key in multiFields) {
    const arr = multiFields[key];
    if (arr && arr.length > 0) {
      condition[key] = { [Op.in]: arr };
    }
  }
  ProjectMethod.findAndCountAll({
    where: condition,
    limit,
    offset,
    // 2. GÜNCELLEME: JOIN İşlemi (Raporları dahil et)
    include: [
      {
        model: Report,
        as: "reports", // index.js dosyasında verdiğimiz 'as' ismiyle AYNI olmalı
        required: false, // false = Left Join (Raporu olmayan projeler de gelsin)
      },
    ],
    distinct: true, // ÖNEMLİ: Join işlemi yapıldığında sayfalama sayısının doğru çalışması için gereklidir
  })
    .then((data) => {
      const response = getPagingData(data, page, limit);
      res.send(response);
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message ||
          "Some error occurred while retrieving project methods.",
      });
    });
};

//get unique value from each column
// controllers/rapor.controller.js içindeki getUniqueValues
exports.getUniqueValues = async (req, res) => {
  try {
    // 1. Filtreleri query'den al (Aynı findAll mantığı)
    const { proje_kodu, yil, kullanilan_yontemler, proje_adi } = req.query;

    let condition = {};
    const multiFields = {
      proje_kodu: toArrayOrUndefined(proje_kodu),
      yil: toArrayOrUndefined(yil),
      kullanilan_yontemler: toArrayOrUndefined(kullanilan_yontemler),
      proje_adi: toArrayOrUndefined(proje_adi),
    };

    for (const key in multiFields) {
      const arr = multiFields[key];
      if (arr && arr.length > 0) {
        condition[key] = { [db.Sequelize.Op.in]: arr };
      }
    }

    // 2. Filtreye uyan TÜM veriyi çek (Sayfalama yok, çünkü grafiğe hepsi lazım)
    const allFilteredData = await ProjectMethod.findAll({
      where: condition,
      attributes: ["proje_kodu", "yil", "kullanilan_yontemler", "proje_adi"],
      raw: true,
    });

    const uniqueCodesSet = new Set();
    const uniqueYearsSet = new Set();
    const uniqueNamesSet = new Set();
    const uniqueMethodsSet = new Set();
    const methodCounts = {};
    const yearCounts = {};

    allFilteredData.forEach((item) => {
      if (item.proje_kodu) uniqueCodesSet.add(item.proje_kodu);
      if (item.proje_adi) uniqueNamesSet.add(item.proje_adi);
      if (item.yil) {
        uniqueYearsSet.add(item.yil);
        yearCounts[item.yil] = (yearCounts[item.yil] || 0) + 1;
      }
      if (item.kullanilan_yontemler) {
        item.kullanilan_yontemler.split(",").forEach((m) => {
          const method = m.trim();
          if (method) {
            uniqueMethodsSet.add(method);
            methodCounts[method] = (methodCounts[method] || 0) + 1;
          }
        });
      }
    });

    res.send({
      proje_kodu: Array.from(uniqueCodesSet).sort(),
      yil: Array.from(uniqueYearsSet).sort((a, b) => b - a),
      proje_adi: Array.from(uniqueNamesSet).sort(),
      kullanilan_yontemler: Array.from(uniqueMethodsSet).sort(),
      stats: { methodCounts, yearCounts },
    });
  } catch (err) {
    res.status(500).send({ message: err.message || "Hata oluştu." });
  }
};
