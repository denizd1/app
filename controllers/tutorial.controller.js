const db = require("../models");
const Tutorial = db.tutorials;
const Sequelize = db.Sequelize;
const Op = db.Sequelize.Op;
const _ = require("lodash");
const fs = require("fs");
const ExcelJS = require("exceljs");
const turflinestring = require("turf-linestring");
const utmObj = require("utm-latlng");

const {
  checkPointInPolygon,
  intersectionCheck,
  intersectionCheckLine,
} = require("./coordfinder.js");

///import utm-latlng
const geojsonobj = require("geojson");

//read tr-cities-utf8.geojson geojson file
const illergeojson = JSON.parse(fs.readFileSync("tr-cities-utf8.geojson"));
const ilceler = JSON.parse(fs.readFileSync("tr_ilce.geojson"));

const converter = (x, y, zone, datum) => {
  if (
    x !== null &&
    x !== undefined &&
    y !== null &&
    y !== undefined &&
    zone !== null &&
    zone !== undefined &&
    datum !== null &&
    datum !== undefined
  ) {
    var utm = null;
    if (datum === "WGS_84") {
      utm = new utmObj("WGS 84");
    } else if (datum === "ED_50") {
      utm = new utmObj("ED50");
    } else {
      throw new Error("Datum bilgisini kontrol ediniz!");
    }
    var point = utm.convertUtmToLatLng(x, y, zone, "N");

    return point;
  } else {
    throw new Error("Koordinat bilgilerini kontrol ediniz.");
  }
};

const getPagination = (page, size) => {
  const limit = size ? +size : 3;
  const offset = page ? page * limit : 0;

  return { limit, offset };
};

const getPagingData = (data, page, limit) => {
  const { count: totalItems, rows: tutorials } = data;
  const currentPage = page ? +page : 0;
  const totalPages = Math.ceil(totalItems / limit);
  return { totalItems, tutorials, totalPages, currentPage };
};

// Retrieve all Tutorials from the database.
exports.findAll = (req, res) => {
  let {
    page,
    size,
    il,
    ilce,
    yontem,
    alt_yontem,
    calisma_amaci,
    proje_kodu,
    kuyu_arsiv_no,
    jeofizik_arsiv_no,
    derleme_no,
    cd_no,
    calisma_tarihi,
    userStatus,
    requestFlag,
    areaJson,
  } = req.query;
  const { limit, offset } = getPagination(page, size);
  var filters = {};
  if (il !== null && il !== undefined) {
    var ilArray = illergeojson.features.filter(
      (item) => item.properties.name.toLowerCase() == il.toLowerCase()
    );
  }
  var condition = null;

  //check if yontem or alt_yontem is array. if not, convert it to array
  if (yontem !== null && yontem !== undefined) {
    if (!Array.isArray(yontem)) {
      yontem = [yontem];
    }
  }
  if (alt_yontem !== null && alt_yontem !== undefined) {
    if (!Array.isArray(alt_yontem)) {
      alt_yontem = [alt_yontem];
    }
  }

  if (
    ilArray !== null &&
    ilArray !== undefined &&
    ilArray.length !== 0 &&
    (areaJson === null || areaJson === undefined)
  ) {
    //create a new array with the arrays in il array
    areaJson = ilArray;
  } else if (areaJson != null) {
    var reg = /^\d+$/;

    if (reg.test(areaJson)) {
      ilArray = ilceler.features.filter(
        (item) => item.properties.Id == areaJson
      );
      areaJson = ilArray;
    } else {
      areaJson = [JSON.parse(areaJson)];
    }
  } else {
    condition = il ? { il: { [Op.iLike]: `%${il}%` } } : null;
  }

  if (requestFlag == "userSearch") {
    var fields = Object.keys(
      _.pick(Tutorial.rawAttributes, [
        "nokta_adi",
        "calisma_amaci",
        "il",
        "ilce",
        "yontem",
        "alt_yontem",
        "yuzbin",
        "yirmibesbin",
        "besyuzbin",
        "proje_kodu",
      ])
    );

    fields.forEach((item) => (filters[item] = { [Op.iLike]: `%${il}%` }));
    condition = il ? { [Op.or]: filters } : null;
  }
  var locationCondition = null;

  if (areaJson != null) {
    locationCondition = Tutorial.sequelize.where(
      Tutorial.sequelize.fn(
        "ST_Contains",
        Tutorial.sequelize.fn(
          "ST_GeomFromGeoJSON",
          JSON.stringify(areaJson[0].geometry)
        ),
        Tutorial.sequelize.col("location")
      ),
      true
    );
  }

  Tutorial.findAndCountAll({
    //when userStatus is user, where contains locationcondition, yontem, limit and offset
    //use only locationcondition, yontem, limit and offset

    where:
      locationCondition != null
        ? [
            locationCondition,
            ilce ? { ilce: { [Op.iLike]: `%${ilce}%` } } : null,

            yontem
              ? {
                  [Op.or]: [
                    { yontem: { [Op.or]: yontem } },
                    { alt_yontem: { [Op.or]: yontem } },
                  ],
                }
              : null,
            calisma_amaci !== null && calisma_amaci !== undefined
              ? //check if array or not

                {
                  calisma_amaci: Array.isArray(calisma_amaci)
                    ? {
                        [Op.or]: calisma_amaci,
                      }
                    : { [Op.iLike]: `%${calisma_amaci}%` },
                }
              : null,
            calisma_tarihi !== null && calisma_tarihi !== undefined
              ? {
                  calisma_tarihi: Array.isArray(calisma_tarihi)
                    ? {
                        [Op.or]: calisma_tarihi.map((value) => ({
                          [Op.iRegexp]: `.*${value}.*`,
                        })),
                      }
                    : {
                        [Op.iRegexp]: `.*${calisma_tarihi}.*`,
                      },
                }
              : null,

            proje_kodu !== null && proje_kodu !== undefined
              ? {
                  proje_kodu: Array.isArray(proje_kodu)
                    ? { [Op.or]: proje_kodu }
                    : { [Op.iLike]: `%${proje_kodu}%` },
                }
              : null,
            kuyu_arsiv_no !== null && kuyu_arsiv_no !== undefined
              ? {
                  kuyu_arsiv_no: Array.isArray(kuyu_arsiv_no)
                    ? { [Op.or]: kuyu_arsiv_no }
                    : { [Op.iLike]: `%${kuyu_arsiv_no}%` },
                }
              : null,
            jeofizik_arsiv_no !== null && jeofizik_arsiv_no !== undefined
              ? {
                  jeofizik_arsiv_no: Array.isArray(jeofizik_arsiv_no)
                    ? { [Op.or]: jeofizik_arsiv_no }
                    : { [Op.iLike]: `%${jeofizik_arsiv_no}%` },
                }
              : null,
            derleme_no !== null && derleme_no !== undefined
              ? {
                  derleme_no: Array.isArray(derleme_no)
                    ? { [Op.or]: derleme_no }
                    : { [Op.iLike]: `%${derleme_no}%` },
                }
              : null,
            cd_no != null && cd_no !== undefined
              ? {
                  cd_no: Array.isArray(cd_no)
                    ? { [Op.or]: cd_no }
                    : { [Op.iLike]: `%${cd_no}%` },
                }
              : null,
            limit,
            offset,
          ]
        : Object.assign(
            {},
            condition,
            ilce ? { ilce: { [Op.iLike]: `%${ilce}%` } } : null,
            yontem
              ? {
                  [Op.or]: [
                    { yontem: { [Op.or]: yontem } },
                    { alt_yontem: { [Op.or]: yontem } },
                  ],
                }
              : null,
            alt_yontem
              ? {
                  [Op.or]: [
                    { yontem: { [Op.or]: alt_yontem } },
                    { alt_yontem: { [Op.or]: alt_yontem } },
                  ],
                }
              : null,
            calisma_amaci !== null && calisma_amaci !== undefined
              ? //check if array or not

                {
                  calisma_amaci: Array.isArray(calisma_amaci)
                    ? {
                        [Op.or]: calisma_amaci,
                      }
                    : { [Op.iLike]: `%${calisma_amaci}%` },
                }
              : null,
            calisma_tarihi !== null && calisma_tarihi !== undefined
              ? {
                  calisma_tarihi: Array.isArray(calisma_tarihi)
                    ? {
                        [Op.or]: calisma_tarihi.map((value) => ({
                          [Op.iRegexp]: `.*${value}.*`,
                        })),
                      }
                    : {
                        [Op.iRegexp]: `.*${calisma_tarihi}.*`,
                      },
                }
              : null,

            proje_kodu !== null && proje_kodu !== undefined
              ? {
                  proje_kodu: Array.isArray(proje_kodu)
                    ? { [Op.or]: proje_kodu }
                    : { [Op.iLike]: `%${proje_kodu}%` },
                }
              : null,
            kuyu_arsiv_no !== null && kuyu_arsiv_no !== undefined
              ? {
                  kuyu_arsiv_no: Array.isArray(kuyu_arsiv_no)
                    ? { [Op.or]: kuyu_arsiv_no }
                    : { [Op.iLike]: `%${kuyu_arsiv_no}%` },
                }
              : null,
            jeofizik_arsiv_no !== null && jeofizik_arsiv_no !== undefined
              ? {
                  jeofizik_arsiv_no: Array.isArray(jeofizik_arsiv_no)
                    ? { [Op.or]: jeofizik_arsiv_no }
                    : { [Op.iLike]: `%${jeofizik_arsiv_no}%` },
                }
              : null,
            derleme_no !== null && derleme_no !== undefined
              ? {
                  derleme_no: Array.isArray(derleme_no)
                    ? { [Op.or]: derleme_no }
                    : { [Op.iLike]: `%${derleme_no}%` },
                }
              : null,
            cd_no != null && cd_no !== undefined
              ? {
                  cd_no: Array.isArray(cd_no)
                    ? { [Op.or]: cd_no }
                    : { [Op.iLike]: `%${cd_no}%` },
                }
              : null,

            //published will be true if the userStatus is 'user'. if not, it can be false or true.
            userStatus == "user"
              ? { published: true }
              : { published: { [Op.or]: [true, false] } }
          ),

    limit,
    offset,
  })
    .then((data) => {
      const response = getPagingData(data, page, limit);
      res.send(response);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving tutorials.",
      });
    });
};

exports.findAllgetAll = (req, res) => {
  let {
    il,
    ilce,
    yontem,
    alt_yontem,
    calisma_amaci,
    proje_kodu,
    kuyu_arsiv_no,
    jeofizik_arsiv_no,
    derleme_no,
    cd_no,
    calisma_tarihi,
    userStatus,
    requestFlag,
  } = req.query;
  //find il in geojson
  if (il !== null && il !== undefined) {
    var ilArray = illergeojson.features.filter(
      (item) => item.properties.name.toLowerCase() == il.toLowerCase()
    );
  }
  //check if yontem or alt_yontem is array. if not, convert it to array
  if (yontem !== null && yontem !== undefined) {
    if (!Array.isArray(yontem)) {
      yontem = [yontem];
    }
  }
  if (alt_yontem !== null && alt_yontem !== undefined) {
    if (!Array.isArray(alt_yontem)) {
      alt_yontem = [alt_yontem];
    }
  }
  var condition = null;
  var locationCondition = null;
  if (ilArray !== null && ilArray !== undefined && ilArray.length !== 0) {
    locationCondition = Tutorial.sequelize.where(
      Tutorial.sequelize.fn(
        "ST_Contains",

        Tutorial.sequelize.fn(
          "ST_GeomFromGeoJSON",
          JSON.stringify(ilArray[0].geometry)
        ),
        Tutorial.sequelize.col("location")
      ),
      true
    );
  } else {
    condition = il ? { il: { [Op.iLike]: `%${il}%` } } : null;
  }

  var filters = {};
  if (requestFlag === "userSearch" || requestFlag === "excel") {
    var fields = Object.keys(
      _.pick(Tutorial.rawAttributes, [
        "nokta_adi",
        "calisma_amaci",
        "il",
        "ilce",
        "yontem",
        "alt_yontem",
        "yuzbin",
        "yirmibesbin",
        "besyuzbin",
        "proje_kodu",
      ])
    );

    fields.forEach((item) => (filters[item] = { [Op.iLike]: `%${il}%` }));
    condition = il ? { [Op.or]: filters } : null;
  }
  if (requestFlag !== "excel") {
    Tutorial.findAll({
      where:
        locationCondition != null
          ? [
              locationCondition,
              ilce ? { ilce: { [Op.iLike]: `%${ilce}%` } } : null,
              yontem
                ? {
                    [Op.or]: [
                      { yontem: { [Op.or]: yontem } },
                      { alt_yontem: { [Op.or]: yontem } },
                    ],
                  }
                : null,
              calisma_amaci !== null && calisma_amaci !== undefined
                ? //check if array or not

                  {
                    calisma_amaci: Array.isArray(calisma_amaci)
                      ? {
                          [Op.or]: calisma_amaci,
                        }
                      : { [Op.iLike]: `%${calisma_amaci}%` },
                  }
                : null,
              calisma_tarihi !== null && calisma_tarihi !== undefined
                ? {
                    calisma_tarihi: Array.isArray(calisma_tarihi)
                      ? {
                          [Op.or]: calisma_tarihi.map((value) => ({
                            [Op.iRegexp]: `.*${value}.*`,
                          })),
                        }
                      : {
                          [Op.iRegexp]: `.*${calisma_tarihi}.*`,
                        },
                  }
                : null,

              proje_kodu !== null && proje_kodu !== undefined
                ? {
                    proje_kodu: Array.isArray(proje_kodu)
                      ? { [Op.or]: proje_kodu }
                      : { [Op.iLike]: `%${proje_kodu}%` },
                  }
                : null,
              kuyu_arsiv_no !== null && kuyu_arsiv_no !== undefined
                ? {
                    kuyu_arsiv_no: Array.isArray(kuyu_arsiv_no)
                      ? { [Op.or]: kuyu_arsiv_no }
                      : { [Op.iLike]: `%${kuyu_arsiv_no}%` },
                  }
                : null,
              jeofizik_arsiv_no !== null && jeofizik_arsiv_no !== undefined
                ? {
                    jeofizik_arsiv_no: Array.isArray(jeofizik_arsiv_no)
                      ? { [Op.or]: jeofizik_arsiv_no }
                      : { [Op.iLike]: `%${jeofizik_arsiv_no}%` },
                  }
                : null,
              derleme_no !== null && derleme_no !== undefined
                ? {
                    derleme_no: Array.isArray(derleme_no)
                      ? { [Op.or]: derleme_no }
                      : { [Op.iLike]: `%${derleme_no}%` },
                  }
                : null,
              cd_no != null && cd_no !== undefined
                ? {
                    cd_no: Array.isArray(cd_no)
                      ? { [Op.or]: cd_no }
                      : { [Op.iLike]: `%${cd_no}%` },
                  }
                : null,
              //published will be true if the userStatus is 'user'. if not, it can be false or true.
              userStatus == "user"
                ? { published: true }
                : { published: { [Op.or]: [true, false] } },
            ]
          : Object.assign(
              {},
              condition,
              ilce ? { ilce: { [Op.iLike]: `%${ilce}%` } } : null,
              yontem
                ? {
                    [Op.or]: [
                      { yontem: { [Op.or]: yontem } },
                      { alt_yontem: { [Op.or]: yontem } },
                    ],
                  }
                : null,
              alt_yontem
                ? {
                    [Op.or]: [
                      { yontem: { [Op.or]: alt_yontem } },
                      { alt_yontem: { [Op.or]: alt_yontem } },
                    ],
                  }
                : null,
              calisma_amaci !== null && calisma_amaci !== undefined
                ? //check if array or not

                  {
                    calisma_amaci: Array.isArray(calisma_amaci)
                      ? {
                          [Op.or]: calisma_amaci,
                        }
                      : { [Op.iLike]: `%${calisma_amaci}%` },
                  }
                : null,
              calisma_tarihi !== null && calisma_tarihi !== undefined
                ? {
                    calisma_tarihi: Array.isArray(calisma_tarihi)
                      ? {
                          [Op.or]: calisma_tarihi.map((value) => ({
                            [Op.iRegexp]: `.*${value}.*`,
                          })),
                        }
                      : {
                          [Op.iRegexp]: `.*${calisma_tarihi}.*`,
                        },
                  }
                : null,

              proje_kodu !== null && proje_kodu !== undefined
                ? {
                    proje_kodu: Array.isArray(proje_kodu)
                      ? { [Op.or]: proje_kodu }
                      : { [Op.iLike]: `%${proje_kodu}%` },
                  }
                : null,
              kuyu_arsiv_no !== null && kuyu_arsiv_no !== undefined
                ? {
                    kuyu_arsiv_no: Array.isArray(kuyu_arsiv_no)
                      ? { [Op.or]: kuyu_arsiv_no }
                      : { [Op.iLike]: `%${kuyu_arsiv_no}%` },
                  }
                : null,
              jeofizik_arsiv_no !== null && jeofizik_arsiv_no !== undefined
                ? {
                    jeofizik_arsiv_no: Array.isArray(jeofizik_arsiv_no)
                      ? { [Op.or]: jeofizik_arsiv_no }
                      : { [Op.iLike]: `%${jeofizik_arsiv_no}%` },
                  }
                : null,
              derleme_no !== null && derleme_no !== undefined
                ? {
                    derleme_no: Array.isArray(derleme_no)
                      ? { [Op.or]: derleme_no }
                      : { [Op.iLike]: `%${derleme_no}%` },
                  }
                : null,
              cd_no != null && cd_no !== undefined
                ? {
                    cd_no: Array.isArray(cd_no)
                      ? { [Op.or]: cd_no }
                      : { [Op.iLike]: `%${cd_no}%` },
                  }
                : null,

              //published will be true if the userStatus is 'user'. if not, it can be false or true.
              userStatus == "user"
                ? { published: true }
                : { published: { [Op.or]: [true, false] } }
            ),
    })
      .then((data) => {
        //count number of points for each alt_yontem
        const altYontemCounts = {};
        data.forEach((item) => {
          if (item.alt_yontem) {
            //if item.yontem is Kuyu Ölçüleri, find the sum of
            //derinlik_m_gr
            // derinlik_m_neu
            // derinlik_m_den
            // derinlik_m_res
            // derinlik_m_sp
            // derinlik_m_cal
            // derinlik_m_term
            // derinlik_m_sgr
            // derinlik_m_cbl
            // derinlik_m_son
            // derinlik_m_ccl

            if (item.yontem === "Kuyu Ölçüleri") {
              const depthFields = [
                "derinlik_m_gr",
                "derinlik_m_neu",
                "derinlik_m_den",
                "derinlik_m_res",
                "derinlik_m_sp",
                "derinlik_m_cal",
                "derinlik_m_term",
                "derinlik_m_sgr",
                "derinlik_m_cbl",
                "derinlik_m_son",
                "derinlik_m_ccl",
              ];
              depthFields.forEach((field) => {
                if (item[field] && !isNaN(item[field])) {
                  altYontemCounts[field] =
                    (altYontemCounts[field] || 0) + parseFloat(item[field]);
                }
              });
            }

            altYontemCounts[item.alt_yontem] =
              (altYontemCounts[item.alt_yontem] || 0) + 1;
          }
        });

        var resdata = null;

        //need to create line for geojson if profil_baslangic_x and profil_baslangic_y is not null
        data.forEach((item) => {
          if (
            item.profil_baslangic_x !== null &&
            item.profil_baslangic_y !== null &&
            item.profil_bitis_x !== null &&
            item.profil_bitis_y !== null
          ) {
            var utm = null;
            if (item.datum === "WGS_84") {
              utm = new utmObj("WGS 84");
            } else if (item.datum === "ED_50") {
              utm = new utmObj("ED50");
            }

            var lineStart = utm.convertUtmToLatLng(
              item.profil_baslangic_x,
              item.profil_baslangic_y,
              item.zone,
              "N"
            );
            var lineEnd = utm.convertUtmToLatLng(
              item.profil_bitis_x,
              item.profil_bitis_y,
              item.zone,
              "N"
            );
            item.line = [
              [lineStart.lat, lineStart.lng],
              [lineEnd.lat, lineEnd.lng],
            ];
          } else {
            item.line = null;
          }
        });
        var forPlot = [];
        const pick = (obj, arr) =>
          arr.reduce(
            (acc, record) => (
              record in obj && (acc[record] = obj[record]), acc
            ),
            {}
          );
        data.forEach((item) =>
          forPlot.push(
            pick(item, [
              "id",
              "yontem",
              "alt_yontem",
              "nokta_adi",
              "proje_kodu",
              "calisma_amaci",
              "calisma_tarihi",
              "x",
              "y",
              "profil_baslangic_x",
              "profil_baslangic_y",
              "profil_bitis_x",
              "profil_bitis_y",
              "zone",
              "line",
              "datum",
              "a_1",
              "a_2",
              "a_3",
              "a_4",
              "lat",
              "lon",
            ])
          )
        );
        const lines = [];
        forPlot.forEach((item) => {
          if (item.line !== null) {
            lines.push(item);
          }
        });
        var resPoints = geojsonobj.parse(forPlot, { Point: ["lon", "lat"] });
        var resLines = lines;

        resdata = { resPoints: resPoints, resLines: resLines };
        //include altYontemCounts to resdata
        resdata["altYontemCounts"] = altYontemCounts;
        res.send(resdata);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send({
          message:
            err.message || "Some error occurred while retrieving tutorials.",
        });
      });
  } else {
    const generateExcelFile = async (res) => {
      const options = {
        filename: "export.xlsx",
        useStyles: true,
        useSharedStrings: true,
      };
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
      const worksheet = workbook.addWorksheet("Sheet 1");

      // Add headers
      // const headers = ["Column1", "Column2", "Column3"]; // Replace with your actual column names
      // worksheet.addRow(headers);
      // Add headers
      const queryOptions = {
        raw: true,
        attributes: {
          exclude: [
            "id",
            "createdAt",
            "updatedAt",
            "editorname",
            "published",
            "lat",
            "lon",
          ],
        },
        where:
          locationCondition != null
            ? [
                locationCondition,
                ilce ? { ilce: { [Op.iLike]: `%${ilce}%` } } : null,
                yontem
                  ? {
                      [Op.or]: [
                        { yontem: { [Op.or]: yontem } },
                        { alt_yontem: { [Op.or]: yontem } },
                      ],
                    }
                  : null,
                calisma_amaci !== null && calisma_amaci !== undefined
                  ? //check if array or not

                    {
                      calisma_amaci: Array.isArray(calisma_amaci)
                        ? {
                            [Op.or]: calisma_amaci,
                          }
                        : { [Op.iLike]: `%${calisma_amaci}%` },
                    }
                  : null,
                calisma_tarihi !== null && calisma_tarihi !== undefined
                  ? {
                      calisma_tarihi: Array.isArray(calisma_tarihi)
                        ? {
                            [Op.or]: calisma_tarihi.map((value) => ({
                              [Op.iRegexp]: `.*${value}.*`,
                            })),
                          }
                        : {
                            [Op.iRegexp]: `.*${calisma_tarihi}.*`,
                          },
                    }
                  : null,

                proje_kodu !== null && proje_kodu !== undefined
                  ? {
                      proje_kodu: Array.isArray(proje_kodu)
                        ? { [Op.or]: proje_kodu }
                        : { [Op.iLike]: `%${proje_kodu}%` },
                    }
                  : null,
                kuyu_arsiv_no !== null && kuyu_arsiv_no !== undefined
                  ? {
                      kuyu_arsiv_no: Array.isArray(kuyu_arsiv_no)
                        ? { [Op.or]: kuyu_arsiv_no }
                        : { [Op.iLike]: `%${kuyu_arsiv_no}%` },
                    }
                  : null,
                jeofizik_arsiv_no !== null && jeofizik_arsiv_no !== undefined
                  ? {
                      jeofizik_arsiv_no: Array.isArray(jeofizik_arsiv_no)
                        ? { [Op.or]: jeofizik_arsiv_no }
                        : { [Op.iLike]: `%${jeofizik_arsiv_no}%` },
                    }
                  : null,
                derleme_no !== null && derleme_no !== undefined
                  ? {
                      derleme_no: Array.isArray(derleme_no)
                        ? { [Op.or]: derleme_no }
                        : { [Op.iLike]: `%${derleme_no}%` },
                    }
                  : null,
                cd_no != null && cd_no !== undefined
                  ? {
                      cd_no: Array.isArray(cd_no)
                        ? { [Op.or]: cd_no }
                        : { [Op.iLike]: `%${cd_no}%` },
                    }
                  : null,
                //published will be true if the userStatus is 'user'. if not, it can be false or true.
                userStatus == "user"
                  ? { published: true }
                  : { published: { [Op.or]: [true, false] } },
              ]
            : Object.assign(
                {},
                condition,
                ilce ? { ilce: { [Op.iLike]: `%${ilce}%` } } : null,
                yontem
                  ? {
                      [Op.or]: [
                        { yontem: { [Op.or]: yontem } },
                        { alt_yontem: { [Op.or]: yontem } },
                      ],
                    }
                  : null,
                alt_yontem
                  ? {
                      [Op.or]: [
                        { yontem: { [Op.or]: alt_yontem } },
                        { alt_yontem: { [Op.or]: alt_yontem } },
                      ],
                    }
                  : null,
                calisma_amaci !== null && calisma_amaci !== undefined
                  ? //check if array or not

                    {
                      calisma_amaci: Array.isArray(calisma_amaci)
                        ? {
                            [Op.or]: calisma_amaci,
                          }
                        : { [Op.iLike]: `%${calisma_amaci}%` },
                    }
                  : null,
                calisma_tarihi !== null && calisma_tarihi !== undefined
                  ? {
                      calisma_tarihi: Array.isArray(calisma_tarihi)
                        ? {
                            [Op.or]: calisma_tarihi.map((value) => ({
                              [Op.iRegexp]: `.*${value}.*`,
                            })),
                          }
                        : {
                            [Op.iRegexp]: `.*${calisma_tarihi}.*`,
                          },
                    }
                  : null,

                proje_kodu !== null && proje_kodu !== undefined
                  ? {
                      proje_kodu: Array.isArray(proje_kodu)
                        ? { [Op.or]: proje_kodu }
                        : { [Op.iLike]: `%${proje_kodu}%` },
                    }
                  : null,
                kuyu_arsiv_no !== null && kuyu_arsiv_no !== undefined
                  ? {
                      kuyu_arsiv_no: Array.isArray(kuyu_arsiv_no)
                        ? { [Op.or]: kuyu_arsiv_no }
                        : { [Op.iLike]: `%${kuyu_arsiv_no}%` },
                    }
                  : null,
                jeofizik_arsiv_no !== null && jeofizik_arsiv_no !== undefined
                  ? {
                      jeofizik_arsiv_no: Array.isArray(jeofizik_arsiv_no)
                        ? { [Op.or]: jeofizik_arsiv_no }
                        : { [Op.iLike]: `%${jeofizik_arsiv_no}%` },
                    }
                  : null,
                derleme_no !== null && derleme_no !== undefined
                  ? {
                      derleme_no: Array.isArray(derleme_no)
                        ? { [Op.or]: derleme_no }
                        : { [Op.iLike]: `%${derleme_no}%` },
                    }
                  : null,
                cd_no != null && cd_no !== undefined
                  ? {
                      cd_no: Array.isArray(cd_no)
                        ? { [Op.or]: cd_no }
                        : { [Op.iLike]: `%${cd_no}%` },
                    }
                  : null,

                //published will be true if the userStatus is 'user'. if not, it can be false or true.
                userStatus == "user"
                  ? { published: true }
                  : { published: { [Op.or]: [true, false] } }
              ),
      };

      const totalCount = await Tutorial.count(queryOptions);

      queryOptions.limit = 10000; // Adjust the batch size based on your needs
      let offset = 0;
      const fetchAndProcessData = async () => {
        const rows = await Tutorial.findAll({
          ...queryOptions,
          offset,
        });

        if (offset === 0 && rows.length > 0) {
          // Extract headers from the first object in the fetched data
          const headers = Object.keys(rows[0]);
          // Add headers to the worksheet
          worksheet.addRow(headers).commit();
        }

        // Process rows
        rows.forEach((row) => {
          worksheet.addRow(Object.values(row)).commit();
        });

        offset += queryOptions.limit;

        if (offset < totalCount) {
          // Continue fetching data in batches
          process.nextTick(fetchAndProcessData);
        } else {
          // All data processed, proceed to write the file

          workbook
            .commit()
            .then(() => {
              const readStream = fs.createReadStream("export.xlsx");
              res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              );
              res.setHeader(
                "Content-Disposition",
                "attachment; filename=export.xlsx"
              );
              readStream.pipe(res);
            })
            .catch((error) => {
              console.error("Error writing XLSX file:", error);
              res.status(500).send("Internal Server Error");
            });
        }
      };

      // Start fetching and processing data
      fetchAndProcessData();
    };
    generateExcelFile(res);
  }
};

//Find all tutorials inside the geojson polygon
exports.findAllGeo = (req, res) => {
  const {
    calisma_amaci,
    proje_kodu,
    kuyu_arsiv_no,
    jeofizik_arsiv_no,
    derleme_no,
    cd_no,
    calisma_tarihi,
    geojson,
    yontem,
    userStatus,
    requestFlag,
  } = req.query;

  var ilceArray = ilceler.features.filter(
    (item) => item.properties.Id == geojson
  );
  var locationCondition = null;

  if (ilceArray.length > 0) {
    locationCondition = Tutorial.sequelize.where(
      Tutorial.sequelize.fn(
        "ST_Contains",

        Tutorial.sequelize.fn(
          "ST_GeomFromGeoJSON",
          JSON.stringify(ilceArray[0].geometry)
        ),
        Tutorial.sequelize.col("location")
      ),
      true
    );
  } else {
    locationCondition = Tutorial.sequelize.where(
      Tutorial.sequelize.fn(
        "ST_Contains",
        Tutorial.sequelize.fn(
          "ST_GeomFromGeoJSON",
          '{"type":"Polygon","coordinates":[[' + geojson + "]]}"
        ),
        Tutorial.sequelize.col("location")
      ),
      true
    );
  }

  if (requestFlag !== "excel") {
    Tutorial.findAll({
      where: [
        locationCondition,
        yontem
          ? {
              [Op.or]: [
                { yontem: { [Op.or]: yontem } },
                { alt_yontem: { [Op.or]: yontem } },
              ],
            }
          : null,
        calisma_amaci !== null && calisma_amaci !== undefined
          ? //check if array or not

            {
              calisma_amaci: Array.isArray(calisma_amaci)
                ? {
                    [Op.or]: calisma_amaci,
                  }
                : { [Op.iLike]: `%${calisma_amaci}%` },
            }
          : null,
        calisma_tarihi !== null && calisma_tarihi !== undefined
          ? {
              calisma_tarihi: Array.isArray(calisma_tarihi)
                ? {
                    [Op.or]: calisma_tarihi.map((value) => ({
                      [Op.iRegexp]: `.*${value}.*`,
                    })),
                  }
                : {
                    [Op.iRegexp]: `.*${calisma_tarihi}.*`,
                  },
            }
          : null,

        proje_kodu !== null && proje_kodu !== undefined
          ? {
              proje_kodu: Array.isArray(proje_kodu)
                ? { [Op.or]: proje_kodu }
                : { [Op.iLike]: `%${proje_kodu}%` },
            }
          : null,
        kuyu_arsiv_no !== null && kuyu_arsiv_no !== undefined
          ? {
              kuyu_arsiv_no: Array.isArray(kuyu_arsiv_no)
                ? { [Op.or]: kuyu_arsiv_no }
                : { [Op.iLike]: `%${kuyu_arsiv_no}%` },
            }
          : null,
        jeofizik_arsiv_no !== null && jeofizik_arsiv_no !== undefined
          ? {
              jeofizik_arsiv_no: Array.isArray(jeofizik_arsiv_no)
                ? { [Op.or]: jeofizik_arsiv_no }
                : { [Op.iLike]: `%${jeofizik_arsiv_no}%` },
            }
          : null,
        derleme_no !== null && derleme_no !== undefined
          ? {
              derleme_no: Array.isArray(derleme_no)
                ? { [Op.or]: derleme_no }
                : { [Op.iLike]: `%${derleme_no}%` },
            }
          : null,
        cd_no != null && cd_no !== undefined
          ? {
              cd_no: Array.isArray(cd_no)
                ? { [Op.or]: cd_no }
                : { [Op.iLike]: `%${cd_no}%` },
            }
          : null,
        userStatus === "user"
          ? { published: true }
          : { published: { [Op.or]: [true, false] } },
      ],
    })
      .then((data) => {
        const altYontemCounts = {};
        data.forEach((item) => {
          if (item.alt_yontem) {
            //if item.yontem is Kuyu Ölçüleri, find the sum of
            //derinlik_m_gr
            // derinlik_m_neu
            // derinlik_m_den
            // derinlik_m_res
            // derinlik_m_sp
            // derinlik_m_cal
            // derinlik_m_term
            // derinlik_m_sgr
            // derinlik_m_cbl
            // derinlik_m_son
            // derinlik_m_ccl

            if (item.yontem === "Kuyu Ölçüleri") {
              const depthFields = [
                "derinlik_m_gr",
                "derinlik_m_neu",
                "derinlik_m_den",
                "derinlik_m_res",
                "derinlik_m_sp",
                "derinlik_m_cal",
                "derinlik_m_term",
                "derinlik_m_sgr",
                "derinlik_m_cbl",
                "derinlik_m_son",
                "derinlik_m_ccl",
              ];
              depthFields.forEach((field) => {
                if (item[field] && !isNaN(item[field])) {
                  altYontemCounts[field] =
                    (altYontemCounts[field] || 0) + parseFloat(item[field]);
                }
              });
            }

            altYontemCounts[item.alt_yontem] =
              (altYontemCounts[item.alt_yontem] || 0) + 1;
          }
        });

        var resdata = null;

        data.forEach((item) => {
          if (
            item.profil_baslangic_x !== null &&
            item.profil_baslangic_y !== null &&
            item.profil_bitis_x !== null &&
            item.profil_bitis_y !== null
          ) {
            var utm = null;
            if (item.datum === "WGS_84") {
              utm = new utmObj("WGS 84");
            } else if (item.datum === "ED_50") {
              utm = new utmObj("ED50");
            }

            var lineStart = utm.convertUtmToLatLng(
              item.profil_baslangic_x,
              item.profil_baslangic_y,
              item.zone,
              "N"
            );
            var lineEnd = utm.convertUtmToLatLng(
              item.profil_bitis_x,
              item.profil_bitis_y,
              item.zone,
              "N"
            );
            item.line = [
              [lineStart.lat, lineStart.lng],
              [lineEnd.lat, lineEnd.lng],
            ];
          } else {
            item.line = null;
          }
        });
        var forPlot = [];
        const pick = (obj, arr) =>
          arr.reduce(
            (acc, record) => (
              record in obj && (acc[record] = obj[record]), acc
            ),
            {}
          );
        data.forEach((item) =>
          forPlot.push(
            pick(item, [
              "id",
              "yontem",
              "alt_yontem",
              "nokta_adi",
              "proje_kodu",
              "x",
              "y",
              "profil_baslangic_x",
              "profil_baslangic_y",
              "profil_bitis_x",
              "profil_bitis_y",
              "calisma_amaci",
              "calisma_tarihi",
              "zone",
              "line",
              "datum",
              "a_1",
              "a_2",
              "a_3",
              "a_4",
              "lat",
              "lon",
            ])
          )
        );
        const lines = [];
        forPlot.forEach((item) => {
          if (item.line !== null) {
            lines.push(item);
          }
        });
        var resPoints = geojsonobj.parse(forPlot, { Point: ["lon", "lat"] });
        var resLines = lines;

        resdata = { resPoints: resPoints, resLines: resLines };
        resdata["altYontemCounts"] = altYontemCounts;
        res.send(resdata);
      })
      .catch((err) => {
        res.status(500).send({
          message:
            err.message || "Some error occurred while retrieving tutorials.",
        });
      });
  } else {
    const generateExcelFile = async (res) => {
      const options = {
        filename: "export.xlsx",
        useStyles: true,
        useSharedStrings: true,
      };
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
      const worksheet = workbook.addWorksheet("Sheet 1");

      // Add headers
      // const headers = ["Column1", "Column2", "Column3"]; // Replace with your actual column names
      // worksheet.addRow(headers);
      // Add headers
      const queryOptions = {
        raw: true,
        attributes: {
          exclude: [
            "id",
            "createdAt",
            "updatedAt",
            "editorname",
            "published",
            "lat",
            "lon",
          ],
        },
        where: [
          locationCondition,
          yontem
            ? {
                [Op.or]: [
                  { yontem: { [Op.or]: yontem } },
                  { alt_yontem: { [Op.or]: yontem } },
                ],
              }
            : null,
          calisma_amaci !== null && calisma_amaci !== undefined
            ? //check if array or not

              {
                calisma_amaci: Array.isArray(calisma_amaci)
                  ? {
                      [Op.or]: calisma_amaci,
                    }
                  : { [Op.iLike]: `%${calisma_amaci}%` },
              }
            : null,
          calisma_tarihi !== null && calisma_tarihi !== undefined
            ? {
                calisma_tarihi: Array.isArray(calisma_tarihi)
                  ? {
                      [Op.or]: calisma_tarihi.map((value) => ({
                        [Op.iRegexp]: `.*${value}.*`,
                      })),
                    }
                  : {
                      [Op.iRegexp]: `.*${calisma_tarihi}.*`,
                    },
              }
            : null,

          proje_kodu !== null && proje_kodu !== undefined
            ? {
                proje_kodu: Array.isArray(proje_kodu)
                  ? { [Op.or]: proje_kodu }
                  : { [Op.iLike]: `%${proje_kodu}%` },
              }
            : null,
          kuyu_arsiv_no !== null && kuyu_arsiv_no !== undefined
            ? {
                kuyu_arsiv_no: Array.isArray(kuyu_arsiv_no)
                  ? { [Op.or]: kuyu_arsiv_no }
                  : { [Op.iLike]: `%${kuyu_arsiv_no}%` },
              }
            : null,
          jeofizik_arsiv_no !== null && jeofizik_arsiv_no !== undefined
            ? {
                jeofizik_arsiv_no: Array.isArray(jeofizik_arsiv_no)
                  ? { [Op.or]: jeofizik_arsiv_no }
                  : { [Op.iLike]: `%${jeofizik_arsiv_no}%` },
              }
            : null,
          derleme_no !== null && derleme_no !== undefined
            ? {
                derleme_no: Array.isArray(derleme_no)
                  ? { [Op.or]: derleme_no }
                  : { [Op.iLike]: `%${derleme_no}%` },
              }
            : null,
          cd_no != null && cd_no !== undefined
            ? {
                cd_no: Array.isArray(cd_no)
                  ? { [Op.or]: cd_no }
                  : { [Op.iLike]: `%${cd_no}%` },
              }
            : null,
          userStatus === "user"
            ? { published: true }
            : { published: { [Op.or]: [true, false] } },
        ],
      };

      const totalCount = await Tutorial.count(queryOptions);

      queryOptions.limit = 10000; // Adjust the batch size based on your needs
      let offset = 0;
      const fetchAndProcessData = async () => {
        const rows = await Tutorial.findAll({
          ...queryOptions,
          offset,
        });

        if (offset === 0 && rows.length > 0) {
          // Extract headers from the first object in the fetched data
          const headers = Object.keys(rows[0]);
          // Add headers to the worksheet
          worksheet.addRow(headers).commit();
        }

        // Process rows
        rows.forEach((row) => {
          worksheet.addRow(Object.values(row)).commit();
        });

        offset += queryOptions.limit;

        if (offset < totalCount) {
          // Continue fetching data in batches
          process.nextTick(fetchAndProcessData);
        } else {
          // All data processed, proceed to write the file

          workbook
            .commit()
            .then(() => {
              const readStream = fs.createReadStream("export.xlsx");
              res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              );
              res.setHeader(
                "Content-Disposition",
                "attachment; filename=export.xlsx"
              );
              readStream.pipe(res);
            })
            .catch((error) => {
              console.error("Error writing XLSX file:", error);
              res.status(500).send("Internal Server Error");
            });
        }
      };

      // Start fetching and processing data
      fetchAndProcessData();
    };
    generateExcelFile(res);
  }
};
// Find a single Tutorial with an id
exports.findOne = (req, res) => {
  const id = req.autosan.params.id;

  Tutorial.findByPk(id)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.status(500).send({
        message: "Error retrieving Tutorial with id=" + id,
      });
    });
};

// Update a Tutorial by the id in the request
exports.update = (req, res) => {
  const id = req.autosan.params.id;
  var fields = Object.keys(req.body);
  let forDeletion = ["id"];
  fields = fields.filter((item) => !forDeletion.includes(item));
  if (req.body["x"] !== null && req.body["y"] !== null) {
    var check = checkPointInPolygon(req.body["lat"], req.body["lon"]);
    req.body["besyuzbin"] = check.besyuz;
    req.body["yuzbin"] = check.yuz;
    req.body["yirmibesbin"] = check.yirmibes;
    req.body["il"] = check.il;
    req.body["ilce"] = check.ilce;
  }
  if (
    req.body["profil_baslangic_x"] !== null &&
    req.body["profil_baslangic_y"] !== null &&
    req.body["profil_bitis_x"] !== null &&
    req.body["profil_bitis_y"] !== null
  ) {
    var polyLineStart = converter(
      req.body["profil_baslangic_x"],
      req.body["profil_baslangic_y"],
      req.body["zone"].length > 1 ? req.body["zone"][0] : req.body["zone"][0],
      req.body["datum"]
    );
    var polyLineEnd = converter(
      req.body["profil_bitis_x"],
      req.body["profil_bitis_y"],
      req.body["zone"].length > 1 ? req.body["zone"][1] : req.body["zone"][0],
      req.body["datum"]
    );
    //make a line from start to end
    var line = turflinestring([
      [polyLineStart.lng, polyLineStart.lat],
      [polyLineEnd.lng, polyLineEnd.lat],
    ]);
    var check = intersectionCheckLine(line);
    req.body["yirmibesbin"] = check.yirmibes.join(", ");
    req.body["yuzbin"] = check.yuz.join(", ");
    req.body["besyuzbin"] = check.besyuz.join(", ");
    req.body["il"] = check.il.join(", ");
    req.body["ilce"] = check.ilce.join(", ");
  }
  if (
    req.body["a_1"] !== null &&
    req.body["a_2"] !== null &&
    req.body["a_3"] !== null &&
    req.body["a_4"] !== null
  ) {
    var corners = [
      req.body["a_1"],
      req.body["a_2"],
      req.body["a_3"],
      req.body["a_4"],
    ]; //typeof string
    var coordinates = [];

    //need to convert string to number then convert utm to latlng
    for (let i = 0; i < corners.length; i++) {
      var corner = corners[i];
      var cornerCoordinates = corner.split(",");
      var x = parseFloat(cornerCoordinates[0]);
      var y = parseFloat(cornerCoordinates[1]);

      var cornerPoint = converter(
        x,
        y,
        req.body["zone"].length > 1 ? req.body["zone"][i] : req.body["zone"][0],
        req.body["datum"]
      );
      coordinates.push([cornerPoint.lng, cornerPoint.lat]);
    }

    var close = converter(
      parseFloat(corners[0].split(",")[0]),
      parseFloat(corners[0].split(",")[1]),
      req.body["zone"].length > 1 ? req.body["zone"][0] : req.body["zone"][0],
      req.body["datum"]
    );
    coordinates.push([parseFloat(close.lng), parseFloat(close.lat)]);
    var geoJson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            mytag: "datdat",
            name: "datdat",
            tessellate: true,
          },
          geometry: {
            type: "Polygon",
            coordinates: [coordinates],
          },
        },
      ],
    };
    var check = intersectionCheck(geoJson);
    //join array elements with whitespace and comma
    req.body["yirmibesbin"] = check.yirmibes.join(", ");
    req.body["yuzbin"] = check.yuz.join(", ");
    req.body["besyuzbin"] = check.besyuz.join(", ");
    req.body["il"] = check.il.join(", ");
    req.body["ilce"] = check.ilce.join(", ");
  }

  Tutorial.update(req.body, {
    //exclude id when updating
    where: { id: id },

    //exclude id when updating
    fields: fields,
  })
    .then((num) => {
      if (num == 1) {
        res.send({
          message: "Tutorial was updated successfully.",
        });
      } else {
        res.send({
          message: `Cannot update Tutorial with id=${id}. Maybe Tutorial was not found or req.body is empty!`,
        });
      }
    })
    .catch((err) => {
      res.status(500).send({
        message: "Error updating Tutorial with id=" + id,
      });
    });
};

// Delete a Tutorial with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  Tutorial.destroy({
    where: { id: id },
  })
    .then((num) => {
      if (num == 1) {
        res.send({
          message: "Tutorial was deleted successfully!",
        });
      } else {
        res.send({
          message: `Cannot delete Tutorial with id=${id}. Maybe Tutorial was not found!`,
        });
      }
    })
    .catch((err) => {
      res.status(500).send({
        message: "Could not delete Tutorial with id=" + id,
      });
    });
};

//get only distinct values of multiple columns
exports.distinct = (req, res) => {
  // Assuming 'columns' is an array of column names you want to retrieve distinct values for
  const distinctValues = {};
  // Assuming 'columns' is an array of column names you want to retrieve distinct values for
  const columns = req.query.column;
  const il = req.query.il;
  const ilce = req.query.ilce;
  const userStatus = req.query.userStatus;
  const yontem = req.query.yontem;
  const calisma_amaci = req.query.calisma_amaci;
  const calisma_tarihi = req.query.calisma_tarihi;
  const proje_kodu = req.query.proje_kodu;
  const kuyu_arsiv_no = req.query.kuyu_arsiv_no;
  const jeofizik_arsiv_no = req.query.jeofizik_arsiv_no;
  const derleme_no = req.query.derleme_no;
  const cd_no = req.query.cd_no;
  var geojson = req.query.geojson;
  var locationCondition = null;

  if (il !== null && il !== undefined) {
    var ilArray = illergeojson.features.filter(
      (item) => item.properties.name.toLowerCase() == il.toLowerCase()
    );
    locationCondition = Tutorial.sequelize.where(
      Tutorial.sequelize.fn(
        "ST_Contains",

        Tutorial.sequelize.fn(
          "ST_GeomFromGeoJSON",
          JSON.stringify(ilArray[0].geometry)
        ),
        Tutorial.sequelize.col("location")
      ),
      true
    );
  }
  if (ilce !== null && ilce !== undefined) {
    var ilceArray = ilceler.features.filter(
      (item) => item.properties.Id == ilce
    );
    locationCondition = Tutorial.sequelize.where(
      Tutorial.sequelize.fn(
        "ST_Contains",

        Tutorial.sequelize.fn(
          "ST_GeomFromGeoJSON",
          JSON.stringify(ilceArray[0].geometry)
        ),
        Tutorial.sequelize.col("location")
      ),
      true
    );
  }
  if (geojson) {
    locationCondition = Tutorial.sequelize.where(
      Tutorial.sequelize.fn(
        "ST_Contains",

        Tutorial.sequelize.fn(
          "ST_GeomFromGeoJSON",
          '{"type":"Polygon","coordinates":[[' + geojson + "]]}"
        ),
        Tutorial.sequelize.col("location")
      ),
      true
    );
  }
  const queryWhere = [
    yontem
      ? {
          [Op.or]: [
            { yontem: { [Op.or]: yontem } },
            { alt_yontem: { [Op.or]: yontem } },
          ],
        }
      : null,
    calisma_amaci !== null && calisma_amaci !== undefined
      ? //check if array or not

        {
          calisma_amaci: Array.isArray(calisma_amaci)
            ? {
                [Op.or]: calisma_amaci,
              }
            : { [Op.iLike]: `%${calisma_amaci}%` },
        }
      : null,
    calisma_tarihi !== null && calisma_tarihi !== undefined
      ? {
          calisma_tarihi: Array.isArray(calisma_tarihi)
            ? {
                [Op.or]: calisma_tarihi.map((value) => ({
                  [Op.iRegexp]: `.*${value}.*`,
                })),
              }
            : {
                [Op.iRegexp]: `.*${calisma_tarihi}.*`,
              },
        }
      : null,

    proje_kodu !== null && proje_kodu !== undefined
      ? {
          proje_kodu: Array.isArray(proje_kodu)
            ? { [Op.or]: proje_kodu }
            : { [Op.iLike]: `%${proje_kodu}%` },
        }
      : null,
    kuyu_arsiv_no !== null && kuyu_arsiv_no !== undefined
      ? {
          kuyu_arsiv_no: Array.isArray(kuyu_arsiv_no)
            ? { [Op.or]: kuyu_arsiv_no }
            : { [Op.iLike]: `%${kuyu_arsiv_no}%` },
        }
      : null,
    jeofizik_arsiv_no !== null && jeofizik_arsiv_no !== undefined
      ? {
          jeofizik_arsiv_no: Array.isArray(jeofizik_arsiv_no)
            ? { [Op.or]: jeofizik_arsiv_no }
            : { [Op.iLike]: `%${jeofizik_arsiv_no}%` },
        }
      : null,
    derleme_no !== null && derleme_no !== undefined
      ? {
          derleme_no: Array.isArray(derleme_no)
            ? { [Op.or]: derleme_no }
            : { [Op.iLike]: `%${derleme_no}%` },
        }
      : null,
    cd_no != null && cd_no !== undefined
      ? {
          cd_no: Array.isArray(cd_no)
            ? { [Op.or]: cd_no }
            : { [Op.iLike]: `%${cd_no}%` },
        }
      : null,
    userStatus === "user"
      ? { published: true }
      : { published: { [Op.or]: [true, false] } },
  ];
  //if locationCondition is not null, add it to queryWhere
  if (locationCondition !== null) {
    queryWhere.unshift(locationCondition);
  }
  const distinctPromises = columns.map((column) => {
    return Tutorial.findAll({
      attributes: [
        [
          Tutorial.sequelize.fn("DISTINCT", Tutorial.sequelize.col(column)),
          column,
        ],
      ],
      where: queryWhere,
      raw: true,
    }).then((results) => {
      distinctValues[column] = results.map((result) => result[column]);
    });
  });

  Promise.all(distinctPromises)
    .then(() => {
      res.send(distinctValues);
    })
    .catch((error) => {
      res.status(500).send({
        message: "Could find distinct values",
      });
    });
};

// find all published Tutorial
exports.findAllPublished = (req, res) => {
  const { page, size } = req.query;
  const { limit, offset } = getPagination(page, size);

  Tutorial.findAndCountAll({ where: { published: true }, limit, offset })
    .then((data) => {
      const response = getPagingData(data, page, limit);
      res.send(response);
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving tutorials.",
      });
    });
};
//find all unpublished tutorial
exports.findAllUnpublished = (req, res) => {
  const { page, size } = req.query;
  const { limit, offset } = getPagination(page, size);

  Tutorial.findAndCountAll({ where: { published: false }, limit, offset })
    .then((data) => {
      const response = getPagingData(data, page, limit);
      res.send(response);
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving tutorials.",
      });
    });
};

//get number of tutorials for each alt_yontem sequelize query raw query SELECT
//    alt_yontem,
//    COUNT (*) AS "numberof"
//  FROM
//     tutorials

//  GROUP BY
//    alt_yontem;
exports.AltYontemCount = (req, res) => {
  Tutorial.count({
    group: "alt_yontem",
    attributes: [
      "alt_yontem",
      [Sequelize.fn("COUNT", Sequelize.col("alt_yontem")), "numberof"],
    ],
  })
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving tutorials.",
      });
    });
};
