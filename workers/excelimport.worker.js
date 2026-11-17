// workers/excelImport.worker.js
// Fully functional background worker for Excel import (BullMQ-based)
require("dotenv").config({ path: __dirname + "/../.env" });
const fs = require("fs");
const Excel = require("exceljs");
const { Worker } = require("bullmq");
const db = require("../models");
const Tutorial = db.tutorials;
const { fileHeader, importData } = require("../utils/excelhelpers");

// ---------------------------
// Redis connection
// ---------------------------
const redisConnection = { connection: { host: "127.0.0.1", port: 6379 } };

// ---------------------------
// Constants and field mapping
// ---------------------------

const BATCH_SIZE = 500;

// ---------------------------
// Geo-processing queue
// ---------------------------
const { Queue } = require("bullmq");
const geoQueue = new Queue("geo-processing", redisConnection);

// ---------------------------
// Excel import worker logic
// ---------------------------
const worker = new Worker(
  "excel-import",
  async (job) => {
    const { filePath, user } = job.data;
    if (!filePath) throw new Error("No filePath provided for Excel import.");

    let insertedCount = 0;
    const errors = [];

    const workbook = new Excel.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(2);
    if (!sheet) throw new Error("Worksheet #2 not found");

    const totalRows = Math.max(0, sheet.rowCount - 1);
    let batch = [];

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const rowObj = {};

      fileHeader.forEach((header, idx) => {
        rowObj[header] = row.getCell(idx + 1).value;
      });

      try {
        const parsed = importData(rowObj, user);
        batch.push(parsed);

        if (batch.length >= BATCH_SIZE) {
          const created = await Tutorial.bulkCreate(batch, {
            returning: true,
            validate: true,
          });

          insertedCount += created.length;
          const ids = created.map((r) => r.id);
          await geoQueue.add("processRows", { ids });

          batch = [];

          await job.updateProgress({
            processedRows: i - 1,
            insertedCount,
            totalRows,
          });
        }
      } catch (err) {
        errors.push({ row: i, error: err.message });
      }
    }

    // Final batch
    if (batch.length > 0) {
      const created = await Tutorial.bulkCreate(batch, {
        returning: true,
        validate: true,
      });
      insertedCount += created.length;
      const ids = created.map((r) => r.id);
      await geoQueue.add("processRows", { ids });
    }

    // Cleanup file
    try {
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    } catch (e) {
      // ignore
    }

    await job.updateProgress({
      processedRows: totalRows,
      insertedCount,
      totalRows,
    });

    const message = `Inserted ${insertedCount} rows successfully. Geo enrichment running in background.`;

    return { message, insertedCount, errors };
  },
  redisConnection
);

worker.on("completed", (job, result) => {
  console.log(`✅ Job ${job.id} completed: ${result.message}`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});
// BullMQ recommends "error" listeners; this also logs a Redis connection error
// as one line instead of the whole error object.
worker.on("error", (err) => {
  console.error("Excel import worker error:", err.message);
});
geoQueue.on("error", (err) => {
  console.error("geo-processing queue error:", err.message);
});

// Graceful stop: an import cut off half way is retried from the first row and
// inserts the rows again, so let the running import finish, then exit. pm2
// sends the "shutdown" message (shutdown_with_message in ecosystem.config.js,
// needed on Windows where there are no signals); SIGINT/SIGTERM cover Ctrl+C
// and Linux.
let stopping = false;
async function shutdown(reason) {
  if (stopping) return;
  stopping = true;
  console.log(`${reason}: finishing the running import, then exiting...`);
  try {
    await worker.close();
    await geoQueue.close();
  } catch (err) {
    console.error("Error while closing the excel import worker:", err);
  }
  process.exit(0);
}
process.on("message", (msg) => {
  if (msg === "shutdown") shutdown("Shutdown requested");
});
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log("📘 Excel import worker started and listening for jobs...");
