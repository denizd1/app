// controllers/excel.controller.js
// Refactored to run the import in a BullMQ worker and return a job ID immediately.

const fs = require("fs");
const path = require("path");
const Excel = require("exceljs");
const { Queue, Worker, QueueEvents } = require("bullmq");

const db = require("../models");
const Tutorial = db.tutorials;

// ---------------------------
// BullMQ setup (Redis)
// ---------------------------
const redisConnection = { connection: { host: "127.0.0.1", port: 6379 } };
const geoQueue = new Queue("geo-processing", redisConnection); // unchanged behavior
const importQueue = new Queue("excel-import", redisConnection);
const importQueueEvents = new QueueEvents("excel-import", redisConnection);
const { fileHeader, importData } = require("../utils/excelhelpers");

// ---------------------------
// Constants & helpers
// ---------------------------

const BATCH_SIZE = 500; // unchanged:contentReference[oaicite:1]{index=1}

// ---------------------------
// Core Excel processing (runs inside the worker)
// ---------------------------
async function processExcel({ filePath, user }, job) {
  let insertedCount = 0;
  const errors = [];

  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile(filePath); // same read mode as original
  const sheet = workbook.getWorksheet(2); // Use second sheet (unchanged index)
  if (!sheet) {
    throw new Error("Worksheet #2 not found in the Excel file");
  }

  const totalRows = Math.max(0, sheet.rowCount - 1); // excluding header row
  let batch = [];

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const rowObj = {};

    // Map cells strictly using fileHeader order (unchanged)
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

        // Enqueue IDs for background geo-processing (unchanged semantics)
        const ids = created.map((r) => r.id);
        await geoQueue.add("processRows", { ids });

        batch = [];

        // progress update
        if (job) {
          await job.updateProgress({
            processedRows: i - 1, // rows up to previous row processed
            insertedCount,
            totalRows,
          });
        }
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

  // Optional cleanup of the uploaded file after successful processing
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  } catch (e) {
    // ignore cleanup errors
  }

  const message = `Inserted ${insertedCount} rows successfully. Geo enrichment running in background.`;

  // Final progress snapshot
  if (job) {
    await job.updateProgress({
      processedRows: totalRows,
      insertedCount,
      totalRows,
    });
  }

  // Return value will be visible via job.returnvalue
  return { message, insertedCount, errors };
}

// ---------------------------
// Worker (singleton guard)
// ---------------------------
// if (!global.__excelImportWorker) {
//   global.__excelImportWorker = new Worker(
//     "excel-import",
//     async (job) => {
//       const { filePath, user } = job.data || {};
//       if (!filePath) throw new Error("Missing filePath in job data");
//       return await processExcel({ filePath, user }, job);
//     },
//     redisConnection
//   );

//   global.__excelImportWorker.on("failed", (job, err) => {
//     console.error(`excel-import job ${job?.id} failed:`, err);
//   });
// }

// ---------------------------
// Controllers (HTTP handlers)
// ---------------------------

/**
 * Start an async import job.
 * Returns: { jobId }
 */
const upload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "File does not exist or is empty" });
  }

  try {
    const filePath = req.file.path; // same source as original
    const user = req.body.user;

    const job = await importQueue.add(
      "excel-import",
      { filePath, user },
      {
        attempts: 3,
        backoff: { type: "fixed", delay: 5000 },
        removeOnComplete: { age: 3600, count: 20 },
        removeOnFail: { age: 86400, count: 50 },
      }
    );

    return res.status(202).json({
      message: "Import queued. Check status with the provided jobId.",
      jobId: job.id,
    });
  } catch (error) {
    console.error("Error enqueuing import:", error);
    return res
      .status(500)
      .json({ message: "Failed to enqueue import job", error: error.message });
  }
};

/**
 * Get job status/progress/result
 * Path: GET /excel/import/status/:id
 */
const status = async (req, res) => {
  const { id } = req.params || {};
  if (!id) return res.status(400).json({ message: "Missing job id" });

  try {
    const job = await importQueue.getJob(id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const state = await job.getState(); // waiting | active | completed | failed | delayed | paused
    const progress = job.progress || null;
    const result = job.returnvalue || null;

    return res.json({ state, progress, result });
  } catch (error) {
    console.error("Error retrieving job status:", error);
    return res
      .status(500)
      .json({ message: "Error retrieving job status", error: error.message });
  }
};

module.exports = { upload, status };
