const { ExpressAdapter } = require("@bull-board/express");
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");

const { Queue } = require("bullmq");

// Match the queues you already have
const redisConnection = { connection: { host: "127.0.0.1", port: 6379 } };

const excelImportQueue = new Queue("excel-import", redisConnection);
const geoProcessingQueue = new Queue("geo-processing", redisConnection);

// Set up the board adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullMQAdapter(excelImportQueue),
    new BullMQAdapter(geoProcessingQueue),
  ],
  serverAdapter: serverAdapter,
});

module.exports = { serverAdapter };
