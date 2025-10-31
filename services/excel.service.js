// ==============================
// FILE: src/services/excel.service.js
// ==============================
const ExcelJS = require("exceljs");

/**
 * Stream Excel export (universal)
 * @param {Model} Tutorial - Sequelize model
 * @param {Object|Array} input - Either Sequelize "where" condition or direct rows
 * @param {Response} res - Express response stream
 */
async function streamExcelFromQuery(Tutorial, input, res) {
  try {
    if (!res.headersSent) {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=tutorials_export_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`
      );
    }

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true,
    });

    const worksheet = workbook.addWorksheet("Data");

    // ✅ input array'sa doğrudan kullan
    let rows = Array.isArray(input)
      ? input
      : await Tutorial.findAll({
          raw: true,
          where: input || {},
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
        });

    if (!rows.length) {
      worksheet.addRow(["No data found for current filters"]).commit();
      await workbook.commit();
      res.end();
      return;
    }

    // 🔁 Object değerlerini düzleştir
    const flattened = rows.map((row) => {
      const flat = {};
      for (const [key, val] of Object.entries(row)) {
        flat[key] =
          val === null || val === undefined
            ? ""
            : typeof val === "object"
            ? JSON.stringify(val)
            : val;
      }
      return flat;
    });

    // Header + rows
    worksheet.addRow(Object.keys(flattened[0])).commit();
    for (const row of flattened) worksheet.addRow(Object.values(row)).commit();

    await workbook.commit();
    res.end();
    console.log(`✅ Excel export completed (${flattened.length} rows)`);
  } catch (err) {
    console.error("streamExcelFromQuery error:", err);
    if (!res.headersSent) res.status(500).send("Excel export error");
  }
}

module.exports = { streamExcelFromQuery };
