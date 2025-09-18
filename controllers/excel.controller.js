const db = require("../models");
const Tutorial = db.tutorials;
const citiesLatLongjson = require("../cities_of_turkey.json");
const { Workbook } = require("exceljs");
const fs = require("fs");
const utmObj = require("utm-latlng");
const centerofmass = require("@turf/center-of-mass");
const turflinestring = require("turf-linestring");
const {
  checkPointInPolygon,
  intersectionCheck,
  intersectionCheckLine,
} = require("./coordfinder.js");

const fileHeader = [
  "nokta_adi",
  "yontem",
  "alt_yontem",
  "calisma_amaci",
  "satilabilirlik",
  "ham_veri",
  "calisma_tarihi",
  "proje_kodu",
  "kuyu_arsiv_no",
  "jeofizik_arsiv_no",
  "derleme_no",
  "cd_no",
  "il",
  "ilce",
  "x",
  "y",
  "z",
  "profil_baslangic_x",
  "profil_baslangic_y",
  "profil_bitis_x",
  "profil_bitis_y",
  "zone",
  "datum",
  "besyuzbin",
  "yuzbin",
  "yirmibesbin",
  "olculen_parametre_ler",
  "acilim_yonu",
  "acilim_yontemi",
  "frekans_araligi",
  "mt_olcu_suresisaat",
  "z_bileseni",
  "amt_olcusu",
  "amt_olcu_suresi",
  "tem_olcusu",
  "kalibrasyon_dosyasi",
  "veri_formati",
  "ab2_m",
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
  "hat_boyu_m",
  "kayit_boyu_sn",
  "sweep_suresi_sn",
  "sweep_tipi",
  "sweep_sayisi",
  "sweep_frekanslari_sn_hz",
  "sweep_taper_ms",
  "yayim_tipi",
  "ofsetm",
  "jeofon_dizilimi",
  "grup_araligim",
  "atis_araligim",
  "ornekleme_araligim",
  "ekipman",
  "enerji_kaynagi",
  "km2",
  "profil_boyukm",
  "elektrot_araligi",
  "dizilim_turu",
  "seviye_sayisi",
  "profil_araligi",
  "a_1",
  "a_2",
  "a_3",
  "a_4",
  "olcu_karne_no",
  "dis_loop_boyutu",
];

const upload = async (req, res) => {
  try {
    if (req.file == undefined) {
      return res.status(400).json({
        message: "File does not exist or is empty",
      });
    }

    const workbook = new Workbook();
    const readStream = fs.createReadStream(req.file.path);

    const tutorials = []; // Array to hold tutorial data

    readStream.on("error", (error) => {
      console.error("Stream error:", error);
      res.status(500).json({
        message: "Some error occurred while reading the file.",
        error: error.message || error,
      });
    });

    workbook.xlsx
      .read(readStream)
      .then(() => {
        const sheet = workbook.getWorksheet(2); // Get the second sheet

        // Get the header row to use as keys
        const headerRow = sheet.getRow(1);
        const headers = headerRow.values.slice(1); // Assuming the first column is skipped

        // Iterate over each row (starting from the second row)
        for (let i = 2; i <= sheet.rowCount; i++) {
          const row = sheet.getRow(i);
          const rowData = {};

          // Construct an object for the current row using headers as keys
          headers.forEach((header, index) => {
            rowData[header] = row.getCell(index + 1).value; // Assuming the first column is skipped
          });

          // Push the row data into the tutorials array
          tutorials.push(importData(rowData, req.body.user));
        }

        return Promise.all(tutorials); // Wait for all tutorial imports to complete
      })
      .then(async () => {
        const createdTutorials = await Tutorial.bulkCreate(tutorials); // Bulk create tutorials
        res.status(200).json({
          message: `Successfully created ${createdTutorials.length} tutorials`,
          data: createdTutorials,
        });
      })
      .catch((error) => {
        console.error("Error importing data:", error);
        res.status(500).json({
          message: "Some error occurred while creating the Tutorial.",
          error: error.message || error,
        });
      });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Could not upload the file: " + req.file.originalname,
      error: error.message || error,
    });
  }
};

const importData = (element, user) => {
  let data = {};
  Object.entries(element).forEach(([key, value], index) => {
    data[fileHeader[index]] = value;

    if (fileHeader[index] === "nokta_adi") {
      if (typeof value === "number") {
        value = value.toString();
      }
      data[fileHeader[index]] = value.includes("_")
        ? value.replace(/_/g, " ")
        : value;
    } else {
      var val = value ? replaceVal(value) : null;
      data[fileHeader[index]] = val; // key - value
    }
  });

  //if data["zone"] contains "," then split and convert to number, else convert to number
  if (data["zone"] === null || data["zone"] === undefined) {
    throw new Error("Zone bilgisini kontrol ediniz!");
  }
  if (typeof data["zone"] === "string" && data["zone"].includes(",")) {
    data["zone"] = data["zone"].split(",").map(Number);
  } else {
    data["zone"] = [parseInt(data["zone"])];
  }

  data["zone"] = data["zone"].map((zone) => {
    if (zone > 39 || zone < 35) {
      throw new Error("Zone bilgisini kontrol ediniz!");
    }
    return zone;
  });

  var latlon = null;
  var dummyCity = null;
  var thisCity = null;

  if (data["x"] !== null && data["y"] !== null) {
    latlon = converter(data["x"], data["y"], data["zone"], data["datum"]);
    data["lat"] = latlon.lng;
    data["lon"] = latlon.lat;

    var check = checkPointInPolygon(data["lat"], data["lon"]);
    data["besyuzbin"] = check.besyuz;
    data["yuzbin"] = check.yuz;
    data["yirmibesbin"] = check.yirmibes;
    data["il"] = check.il;
    data["ilce"] = check.ilce;
  } else if (data["il"] !== null && data["x"] === null && data["y"] === null) {
    dummyCity = il.includes(",") ? il.split(",")[0].trim() : il.trim();

    thisCity = citiesLatLongjson.find((city) => city.il === dummyCity);

    if (!thisCity) {
      throw new Error(`Şehir "${dummyCity}" bulunamadı.`);
    }

    data["lat"] = parseFloat(thisCity.longitude);
    data["lon"] = parseFloat(thisCity.latitude);
  }

  if (
    data["profil_baslangic_x"] !== null &&
    data["profil_baslangic_y"] !== null &&
    data["profil_bitis_x"] !== null &&
    data["profil_bitis_y"] !== null
  ) {
    var polyLineStart = converter(
      data["profil_baslangic_x"],
      data["profil_baslangic_y"],
      data["zone"].length > 1 ? data["zone"][0] : data["zone"][0],
      data["datum"]
    );
    var polyLineEnd = converter(
      data["profil_bitis_x"],
      data["profil_bitis_y"],
      data["zone"].length > 1 ? data["zone"][1] : data["zone"][0],
      data["datum"]
    );
    //make a line from start to end
    var line = turflinestring([
      [polyLineStart.lng, polyLineStart.lat],
      [polyLineEnd.lng, polyLineEnd.lat],
    ]);
    var check = intersectionCheckLine(line);
    data["yirmibesbin"] = check.yirmibes.join(", ");
    data["yuzbin"] = check.yuz.join(", ");
    data["besyuzbin"] = check.besyuz.join(", ");
    data["il"] = check.il.join(", ");
    data["ilce"] = check.ilce.join(", ");

    /*
     * Find midpoint between two coordinates points
     * Source : http://www.movable-type.co.uk/scripts/latlong.html
     */

    //-- Define radius function
    if (typeof Number.prototype.toRad === "undefined") {
      Number.prototype.toRad = function () {
        return (this * Math.PI) / 180;
      };
    }

    //-- Define degrees function
    if (typeof Number.prototype.toDeg === "undefined") {
      Number.prototype.toDeg = function () {
        return this * (180 / Math.PI);
      };
    }

    //-- Define middle point function

    //-- Longitude difference
    var dLng = (polyLineEnd.lng - polyLineStart.lng).toRad();

    //-- Convert to radians
    var lat1 = polyLineStart.lat.toRad();
    var lat2 = polyLineEnd.lat.toRad();
    var lng1 = polyLineStart.lng.toRad();

    var bX = Math.cos(lat2) * Math.cos(dLng);
    var bY = Math.cos(lat2) * Math.sin(dLng);
    var lat3 = Math.atan2(
      Math.sin(lat1) + Math.sin(lat2),
      Math.sqrt((Math.cos(lat1) + bX) * (Math.cos(lat1) + bX) + bY * bY)
    );
    var lng3 = lng1 + Math.atan2(bY, Math.cos(lat1) + bX);
    data["lat"] = lng3.toDeg();
    data["lon"] = lat3.toDeg();
  }

  if (
    data["a_1"] !== null &&
    data["a_2"] !== null &&
    data["a_3"] !== null &&
    data["a_4"] !== null
  ) {
    var corners = [data["a_1"], data["a_2"], data["a_3"], data["a_4"]]; //typeof string
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
        data["zone"].length > 1 ? data["zone"][i] : data["zone"][0],
        data["datum"]
      );
      coordinates.push([cornerPoint.lng, cornerPoint.lat]);
    }

    var close = converter(
      parseFloat(corners[0].split(",")[0]),
      parseFloat(corners[0].split(",")[1]),
      data["zone"].length > 1 ? data["zone"][0] : data["zone"][0],
      data["datum"]
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
    data["yirmibesbin"] = check.yirmibes.join(", ");
    data["yuzbin"] = check.yuz.join(", ");
    data["besyuzbin"] = check.besyuz.join(", ");
    data["il"] = check.il.join(", ");
    data["ilce"] = check.ilce.join(", ");

    var centerOfMass = centerofmass.default(geoJson);
    data["lat"] = centerOfMass.geometry.coordinates[0];
    data["lon"] = centerOfMass.geometry.coordinates[1];
  }
  if (typeof data["calisma_tarihi"] !== "string") {
    var regex = /^(181[2-9]|18[2-9]\d|19\d\d|2\d{3}|30[0-3]\d|304[0-8])$/;
    if (regex.test(data["calisma_tarihi"])) {
      data["calisma_tarihi"] = data["calisma_tarihi"].toString();
    } else {
      data["calisma_tarihi"] =
        data["calisma_tarihi"].getUTCDate() +
        "/" +
        (data["calisma_tarihi"].getUTCMonth() + 1) +
        "/" +
        data["calisma_tarihi"].getUTCFullYear();
    }
  } else if (typeof data["calisma_tarihi"] === "string") {
    data["calisma_tarihi"] = data["calisma_tarihi"];
  } else {
    throw new Error("Çalışma tarihini kontrol ediniz.");
  }
  //   Object.entries(element).forEach(([key, value]) => {
  //     data[key] = replaceVal(value); // key - value
  //     if (key != "zone" || key != "lat" || key != "lon") {
  //       data[key] = value !== null ? value.toString() : null;
  //     }
  //   });
  //fetch pafta25000.geojson from root
  //check if point is in polygon
  //if not throw error
  //if yes then continue
  //if data["lat"] and data["lon"] is null then throw error
  //if data["lat"] and data["lon"] is not null then continue

  for (const [key, value] of Object.entries(data)) {
    // Skip processing for specified keys
    if (["il", "ilce", "yuzbin", "besyuzbin", "yirmibesbin"].includes(key)) {
      continue;
    }
    data[key] = replaceVal(value);

    data[key] = value !== null ? value.toString() : null;

    if (key === "lat" || key === "lon") {
      data[key] = value !== null ? parseFloat(value) : null;
    }
  }

  data["published"] = false;
  data["editorname"] = user.toString();
  return data;
};

const replaceVal = (value) => {
  switch (value) {
    case "POTANSıYEL_ALAN_YONTEMLERI":
      return "Potansiyel Alan Yöntemleri";
    case "ELEKTRIK_VE_ELEKTROMANYETIK_YONTEMLER":
      return "Elektrik ve Elektromanyetik Yöntemler";
    case "SISMIK_YONTEMLER":
      return "Sismik Yöntemler";
    case "KUYU_OLCULERI":
      return "Kuyu Ölçüleri";
    case "GRAVITE":
      return "Gravite";
    case "MANYETIK":
      return "Manyetik";
    case "HAVADAN MANYETIK":
      return "Havadan Manyetik";
    case "HAVADAN GRAVITE":
      return "Havadan Gravite";
    case "UYDU GORUNTUSU":
      return "uydu Görüntüsü";
    case "RADYOMETRI":
      return "Radyometri";
    case "SUSEPTIBILITE":
      return "Suseptibilite";
    case "DUSEY_ELEKTRIK_SONDAJI(DES)":
      return "Düşey Elektrik Sondajı (DES)";
    case "GECICI_ELEKTROMANYETIK_YONTEM(TEM)":
      return "Geçici Elektromanyetik Yöntem (TEM)";
    case "YAPAY_UCLASMA_YONTEMI(IP)":
      return "Yapay Uçlaşma Yöntemi (IP)";
    case "GRADIENT_YAPAY_UCLASMA_YONTEMI(IP)":
      return "Gradient Yapay Uçlaşma Yöntemi (IP)";
    case "MANYETO_TELLURIK(MT)":
      return "Manyetotellürik (MT)";
    case "AUDIO_MANYETO_TELLURIK(AMT)":
      return "Audio Manyetotellürik (AMT)";
    case "YAPAY_KAYNAKLI_AUDIO_MANYETO_TELLURIK(CSAMT)":
      return "Yapay Kaynaklı Audio Manyetotellürik (CSAMT)";
    case "DOGAL_POTANSIYEL(SP)":
      return "Doğal Potansiyel (SP)";
    case "COK_KANALLI_OZDIRENC_YONTEMI":
      return "Çok Kanallı Özdirenç Yöntemi";
    case "2_BOYUTLU_SISMIK_YANSIMA":
      return "2 Boyutlu Sismik Yansıma";
    case "2_BOYUTLU_SISMIK_KIRILMA":
      return "2 Boyutlu Sismik Kırılma";
    case "YER_RADARI":
      return "Yer Radarı";
    case "GAMMA_RAY(GR)":
      return "Gamma Ray (Gr)";
    case "NEUTRON(NEU)":
      return "Neutron (Neu)";
    case "DENSITY(DEN)":
      return "Density (Den)";
    case "RESISTVITY(RES)":
      return "Resistivity (Res)";
    case "SELF_POTANTIAL(SP)":
      return "Self Potential (SP)";
    case "CALIPER(CAL)":
      return "Caliper (Cal)";
    case "SICAKLIK_LOGU(TERM)":
      return "Sıcaklık Logu (Term)";
    case "SPEKTRAL_GAMMARAY(SGR)":
      return "Spektral Gammaray (SGR)";
    case "CIMENTO_LOGU(CBL)":
      return "Çimento Logu (Cbl)";
    case "SONIC_LOG(SON)":
      return "Sonic Log (Son)";
    case "CASING_COLLOR_LOCATOR(CCL)":
      return "Casing Collor Locator (CCL)";
    case "BIRLESIK_LOG":
      return "Birleşik Log";
    case "LİNEER":
      return "Lineer";
    case "SATILABILIR":
      return "Satılabilir";
    case "RADYOAKTİF HAMMADDE":
      return "Radyoaktif Hammadde";
    case "KOMUR":
      return "Kömür";
    case "JEOTERMAL":
      return "Jeotermal";
    case "VAR":
      return "Var";
    case "YOK":
      return "Yok";
    default:
      return value;
  }
};

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

module.exports = {
  upload,
};
