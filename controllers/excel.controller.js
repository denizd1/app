// controllers/excel.controller.js
const db = require("../models");
const Tutorial = db.tutorials;
const Excel = require("exceljs");
const { Queue } = require("bullmq");

// Redis connection for BullMQ
const redisConnection = { connection: { host: "127.0.0.1", port: 6379 } };
const geoQueue = new Queue("geo-processing", redisConnection);

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

const BATCH_SIZE = 500;

/**
 * Normalize date values into dd/mm/yyyy format or string
 */
function normalizeDate(val) {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (val instanceof Date) {
    return (
      val.getUTCDate() +
      "/" +
      (val.getUTCMonth() + 1) +
      "/" +
      val.getUTCFullYear()
    );
  }
  return val.toString();
}

/**
 * Replace coded values with human-readable equivalents
 */
function replaceVal(value) {
  const map = {
    POTANSıYEL_ALAN_YONTEMLERI: "Potansiyel Alan Yöntemleri",
    ELEKTRIK_VE_ELEKTROMANYETIK_YONTEMLER:
      "Elektrik ve Elektromanyetik Yöntemler",
    SISMIK_YONTEMLER: "Sismik Yöntemler",
    KUYU_OLCULERI: "Kuyu Ölçüleri",
    GRAVITE: "Gravite",
    MANYETIK: "Manyetik",
    "HAVADAN MANYETIK": "Havadan Manyetik",
    "HAVADAN GRAVITE": "Havadan Gravite",
    "UYDU GORUNTUSU": "Uydu Görüntüsü",
    RADYOMETRI: "Radyometri",
    SUSEPTIBILITE: "Suseptibilite",
    "DUSEY_ELEKTRIK_SONDAJI(DES)": "Düşey Elektrik Sondajı (DES)",
    "GECICI_ELEKTROMANYETIK_YONTEM(TEM)": "Geçici Elektromanyetik Yöntem (TEM)",
    "YAPAY_UCLASMA_YONTEMI(IP)": "Yapay Uçlaşma Yöntemi (IP)",
    "GRADIENT_YAPAY_UCLASMA_YONTEMI(IP)": "Gradient Yapay Uçlaşma Yöntemi (IP)",
    "MANYETO_TELLURIK(MT)": "Manyetotellürik (MT)",
    "AUDIO_MANYETO_TELLURIK(AMT)": "Audio Manyetotellürik (AMT)",
    "YAPAY_KAYNAKLI_AUDIO_MANYETO_TELLURIK(CSAMT)":
      "Yapay Kaynaklı Audio Manyetotellürik (CSAMT)",
    "DOGAL_POTANSIYEL(SP)": "Doğal Potansiyel (SP)",
    COK_KANALLI_OZDIRENC_YONTEMI: "Çok Kanallı Özdirenç Yöntemi",
    "2_BOYUTLU_SISMIK_YANSIMA": "2 Boyutlu Sismik Yansıma",
    "2_BOYUTLU_SISMIK_KIRILMA": "2 Boyutlu Sismik Kırılma",
    YER_RADARI: "Yer Radarı",
    "GAMMA_RAY(GR)": "Gamma Ray (Gr)",
    "NEUTRON(NEU)": "Neutron (Neu)",
    "DENSITY(DEN)": "Density (Den)",
    "RESISTVITY(RES)": "Resistivity (Res)",
    "SELF_POTANTIAL(SP)": "Self Potential (SP)",
    "CALIPER(CAL)": "Caliper (Cal)",
    "SICAKLIK_LOGU(TERM)": "Sıcaklık Logu (Term)",
    "SPEKTRAL_GAMMARAY(SGR)": "Spektral Gammaray (SGR)",
    "CIMENTO_LOGU(CBL)": "Çimento Logu (Cbl)",
    "SONIC_LOG(SON)": "Sonic Log (Son)",
    "CASING_COLLOR_LOCATOR(CCL)": "Casing Collor Locator (CCL)",
    BIRLESIK_LOG: "Birleşik Log",
    LİNEER: "Lineer",
    SATILABILIR: "Satılabilir",
    "RADYOAKTİF HAMMADDE": "Radyoaktif Hammadde",
    KOMUR: "Kömür",
    JEOTERMAL: "Jeotermal",
    VAR: "Var",
    YOK: "Yok",
  };
  return map[value] || value;
}

/**
 * Lightweight import (no heavy geo logic here)
 */
function importData(element, user) {
  const data = {};
  fileHeader.forEach((header) => {
    let val = element[header];
    if (header === "calisma_tarihi") val = normalizeDate(val);
    if (typeof val === "string") val = replaceVal(val);
    data[header] = val ?? null;
  });
  data["published"] = false;
  data["editorname"] = user.toString();
  return data;
}

/**
 * Upload controller
 */
const upload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "File does not exist or is empty" });
  }

  let insertedCount = 0;
  const errors = [];

  try {
    const workbook = new Excel.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.getWorksheet(2); // Use second sheet

    let batch = [];

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const rowObj = {};

      // Map cells strictly using fileHeader order
      fileHeader.forEach((header, idx) => {
        rowObj[header] = row.getCell(idx + 1).value;
      });

      try {
        const parsed = importData(rowObj, req.body.user);
        batch.push(parsed);

        if (batch.length >= BATCH_SIZE) {
          const created = await Tutorial.bulkCreate(batch, {
            returning: true,
            validate: true,
          });

          console.log(`Inserted batch of ${created.length}`);
          insertedCount += created.length;

          // enqueue IDs for background processing
          const ids = created.map((r) => r.id);
          await geoQueue.add("processRows", { ids });

          batch = [];
        }
      } catch (err) {
        errors.push({ row: i, error: err.message });
      }
    }

    // Flush remaining batch
    if (batch.length > 0) {
      const created = await Tutorial.bulkCreate(batch, {
        returning: true,
        validate: true,
      });
      insertedCount += created.length;
      const ids = created.map((r) => r.id);
      await geoQueue.add("processRows", { ids });
    }

    res.status(200).json({
      message: `Inserted ${insertedCount} rows successfully. Geo enrichment running in background.`,
      errors,
    });
  } catch (error) {
    console.error("Error importing data:", error);
    res
      .status(500)
      .json({ message: "Error processing file", error: error.message });
  }
};

module.exports = { upload };
