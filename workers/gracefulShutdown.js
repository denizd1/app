// Graceful stop for the BullMQ workers run by PM2: the job that is running is
// finished first, then the process exits. PM2 asks with a "shutdown" message
// (shutdown_with_message in ecosystem.config.js, needed on Windows where there
// are no signals); SIGINT/SIGTERM cover Ctrl+C and Linux. PM2 kills the
// process anyway after kill_timeout.

// How long to keep waiting for a running job while Redis is unreachable. A
// Redis restart takes a moment; when Redis is stopped (pm2 stop all / pm2 kill)
// the job cannot be marked finished anyway.
const REDIS_GRACE_MS = 15000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = function exitAfterRunningJobs(worker, name) {
  // Jobs that have started and are not yet marked completed/failed in Redis.
  const activeJobs = new Set();
  worker.on("active", (job) => activeJobs.add(job.id));
  worker.on("completed", (job) => activeJobs.delete(job.id));
  worker.on("failed", (job) => job && activeJobs.delete(job.id));

  let stopping = false;
  async function shutdown(reason) {
    if (stopping) return;
    stopping = true;
    console.log(`${reason}: ${name} finishes its running job, then exits...`);
    // Take no new jobs. Not awaited: close() also waits for Redis to answer,
    // which never comes when Redis is stopped too.
    worker.close().catch(() => {});

    const client = await Promise.race([worker.client, sleep(1000)]);
    let redisDownSince = null;
    while (activeJobs.size > 0) {
      if (client && client.status === "ready") {
        redisDownSince = null;
      } else if (redisDownSince === null) {
        redisDownSince = Date.now();
      } else if (Date.now() - redisDownSince > REDIS_GRACE_MS) {
        console.log(`Redis is unreachable, ${name} exits without waiting.`);
        break;
      }
      await sleep(200);
    }
    process.exit(0);
  }

  process.on("message", (msg) => {
    if (msg === "shutdown") shutdown("Shutdown requested");
  });
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};
