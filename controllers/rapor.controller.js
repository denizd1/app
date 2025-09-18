const db = require("../models");
const Rapor = db.rapor;
const Op = db.Sequelize.Op;

const getPagination = (page, size) => {
  const limit = size ? +size : 3;
  const offset = page ? page * limit : 0;

  return { limit, offset };
};

const getPagingData = (data, page, limit) => {
  const { count: totalItems, rows: rapors } = data;
  const currentPage = page ? +page : 0;
  const totalPages = Math.ceil(totalItems / limit);
  return { totalItems, rapors, totalPages, currentPage };
};
function toArrayOrUndefined(param) {
  if (!param) return undefined;
  return param
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

//get all rapors
exports.findAll = (req, res) => {
  const {
    page,
    size,
    sistemde,
    bilimsel_derleme_no,
    yeni_arsiv_no,
    jeofizik_arsiv_no,
    kuyu_logu_rapor_no,
    cd_no,
    hard_disk_durumu,
    olcu_karne_no,
    proje_kodu,
    rapor_adi,
    yazarlar,
    il,
    ilce,
    calisma_yili,
  } = req.query;

  const { limit, offset } = getPagination(page, size);

  let condition = {};

  const multiFields = {
    bilimsel_derleme_no: toArrayOrUndefined(bilimsel_derleme_no),
    yeni_arsiv_no: toArrayOrUndefined(yeni_arsiv_no),
    jeofizik_arsiv_no: toArrayOrUndefined(jeofizik_arsiv_no),
    kuyu_logu_rapor_no: toArrayOrUndefined(kuyu_logu_rapor_no),
    cd_no: toArrayOrUndefined(cd_no),
    hard_disk_durumu: toArrayOrUndefined(hard_disk_durumu),
    olcu_karne_no: toArrayOrUndefined(olcu_karne_no),
    proje_kodu: toArrayOrUndefined(proje_kodu),
    rapor_adi: toArrayOrUndefined(rapor_adi),
    yazarlar: toArrayOrUndefined(yazarlar),
    il: toArrayOrUndefined(il),
    ilce: toArrayOrUndefined(ilce),
    calisma_yili: toArrayOrUndefined(calisma_yili),
  };

  for (const key in multiFields) {
    const arr = multiFields[key];
    if (arr && arr.length > 0) {
      condition[key] = { [Op.in]: arr };
    }
  }

  if (sistemde) {
    condition.sistemde = { [Op.like]: `%${sistemde}%` };
  }

  Rapor.findAndCountAll({
    where: condition,
    limit,
    offset,
  })
    .then((data) => {
      const response = getPagingData(data, page, limit);
      res.send(response);
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving rapors.",
      });
    });
};
//get unique value from each column
exports.getUniqueValues = async (req, res) => {
  const columns = [
    "bilimsel_derleme_no",
    "jeofizik_arsiv_no",
    "kuyu_logu_rapor_no",
    "cd_no",
    "olcu_karne_no",
    "proje_kodu",
    "rapor_adi",
    "yazarlar",
    "il",
    "ilce",
    "calisma_yili",
  ];

  try {
    const results = await Promise.all(
      columns.map((column) =>
        Rapor.findAll({
          attributes: [
            [db.Sequelize.fn("DISTINCT", db.Sequelize.col(column)), column],
          ],
          raw: true,
        })
      )
    );

    const uniqueValues = {};

    columns.forEach((column, index) => {
      const values = results[index]
        .map((item) => item[column])
        .filter((v) => v !== null && v !== undefined); // remove nulls

      const valueSet = new Set();

      // If column is expected to be a list (comma-separated), split and flatten
      const shouldSplit = [
        "yazarlar",
        "il",
        "ilce",
        "bilimsel_derleme_no",
        "jeofizik_arsiv_no",
        "kuyu_logu_rapor_no",
        "calisma_yili",
        "cd_no",
        "olcu_karne_no",
      ]; // expand this list if needed

      values.forEach((v) => {
        if (shouldSplit.includes(column)) {
          v.split(",").forEach((item) => {
            const trimmed = item.trim();
            if (trimmed) valueSet.add(trimmed);
          });
        } else {
          const trimmed = v.toString().trim();
          if (trimmed) valueSet.add(trimmed);
        }
      });

      uniqueValues[column] = Array.from(valueSet).sort();
    });

    res.send(uniqueValues);
  } catch (err) {
    res.status(500).send({
      message:
        err.message || "Some error occurred while retrieving unique values.",
    });
  }
};

//get rapor by id
exports.findOne = (req, res) => {
  const id = req.params.id;

  Rapor.findByPk(id)
    .then((data) => {
      if (data) {
        res.send(data);
      } else {
        res.status(404).send({
          message: `Cannot find Rapor with id=${id}.`,
        });
      }
    })
    .catch((err) => {
      res.status(500).send({
        message: "Error retrieving Rapor with id=" + id,
      });
    });
};
