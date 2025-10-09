// ==============================
// FILE: src/services/excel.service.js
// ==============================
const fs2 = require("fs");
const ExcelJS = require("exceljs");

async function streamExcelFromQuery(Tutorial, whereArray, res) {
  const options = {
    filename: "export.xlsx",
    useStyles: true,
    useSharedStrings: true,
  };
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
  const worksheet = workbook.addWorksheet("Sheet 1");

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
    where: whereArray,
  };

  const totalCount = await Tutorial.count(queryOptions);
  queryOptions.limit = 10000;
  let offset = 0;

  const fetchAndProcessData = async () => {
    const rows = await Tutorial.findAll({ ...queryOptions, offset });

    if (offset === 0 && rows.length > 0) {
      const headers = Object.keys(rows[0]);
      worksheet.addRow(headers).commit();
    }

    rows.forEach((row) => {
      worksheet.addRow(Object.values(row)).commit();
    });

    offset += queryOptions.limit;

    if (offset < totalCount) {
      process.nextTick(fetchAndProcessData);
    } else {
      workbook
        .commit()
        .then(() => {
          const readStream = fs2.createReadStream("export.xlsx");
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

  fetchAndProcessData();
}

module.exports = { streamExcelFromQuery };
