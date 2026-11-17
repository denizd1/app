// PM2 process file: the web server (cluster mode, one copy per CPU core), the
// two BullMQ workers and an hourly log rotation job.
//
//   npx pm2 start ecosystem.config.js    start everything
//   npx pm2 reload ecosystem.config.js   apply a code update (web: no downtime)
//   npx pm2 save                         remember the list for `pm2 resurrect`
//
// Setup on the offline Windows server: docs/PM2_KURULUM.md
//
// Process counts and memory limits are computed from the machine. On an
// 8 GB / 4 vCPU server: 4 web copies, 2 geo workers, 1 Excel worker; heap
// limits 2048 / 2048 / 4096 MB. To use other values set the variables below
// (e.g. `setx WEB_INSTANCES 3`), then in a new shell `npx pm2 delete all`,
// `npx pm2 start ecosystem.config.js` and `npx pm2 save`.
const os = require("os");

const CPUS =
  typeof os.availableParallelism === "function"
    ? os.availableParallelism()
    : os.cpus().length;
// Rounded so that e.g. 7.9 GB visible to Windows counts as 8 GB.
const RAM_GB = Math.max(1, Math.round(os.totalmem() / 1024 ** 3));

// Positive integer from the environment, otherwise the default.
function setting(name, defaultValue) {
  const value = parseInt(process.env[name], 10);
  return value > 0 ? value : defaultValue;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Math.floor(value), min), max);
}

// Web server: one copy per CPU core (each uses ~0.4 GB at rest because of the
// GeoJSON data), at most one copy per 2 GB of RAM.
const WEB_INSTANCES = setting("WEB_INSTANCES", clamp(RAM_GB / 2, 1, CPUS));

// Geo workers do CPU-heavy polygon intersection; several copies work through
// the geo-processing queue in parallel (BullMQ gives each job to one worker
// only). Default: half of the cores, at most one per 2 GB of RAM.
const GEO_WORKERS = setting(
  "GEO_WORKERS",
  clamp(Math.min(CPUS / 2, RAM_GB / 2), 1, CPUS),
);

// The Excel import holds the whole workbook in memory, so it runs as a single
// copy that may use a lot of RAM.
const EXCEL_WORKERS = setting("EXCEL_WORKERS", 1);

// Node limits its heap to ~2 GB on this kind of machine whatever the RAM is.
// These are the limits per process in MB (a ceiling, not a reservation).
const WEB_HEAP_MB = setting("WEB_HEAP_MB", clamp((RAM_GB * 1024) / 4, 1024, 4096));
const GEO_HEAP_MB = setting("GEO_HEAP_MB", clamp((RAM_GB * 1024) / 4, 1024, 4096));
const EXCEL_HEAP_MB = setting("EXCEL_HEAP_MB", Math.max(2048, (RAM_GB * 1024) / 2));

// Shared by all apps.
const common = {
  // Run from the project folder: .env and the *.geojson files are read with
  // paths relative to it, whatever folder pm2 is started from.
  cwd: __dirname,
  env: { NODE_ENV: "production" },
  // One log file per app instead of one per instance.
  merge_logs: true,
  log_date_format: "YYYY-MM-DD HH:mm:ss",
};

// Shared by the apps that must always run.
const service = {
  ...common,
  autorestart: true,
  // After a crash wait 0.1 s, then 0.15 s, 0.22 s ... up to 15 s before the
  // next restart (e.g. while PostgreSQL or Redis are still starting after a
  // reboot). The delay resets once the app has been up for 30 s.
  exp_backoff_restart_delay: 100,
};

module.exports = {
  apps: [
    {
      ...service,
      name: "app-server",
      script: "./server.js",
      exec_mode: "cluster",
      instances: WEB_INSTANCES,
      node_args: [`--max-old-space-size=${WEB_HEAP_MB}`],
      // Leak guard: a copy using more than this is restarted while the
      // other copies keep serving.
      max_memory_restart: `${WEB_HEAP_MB}M`,
      // `pm2 reload` waits until the new copy listens (it loads GeoJSON
      // first) before stopping the old one.
      listen_timeout: 30000,
    },
    {
      ...service,
      name: "geo-worker",
      script: "./workers/geoworker.js",
      exec_mode: "fork",
      instances: GEO_WORKERS,
      node_args: [`--max-old-space-size=${GEO_HEAP_MB}`],
      // Stop/restart asks the worker to finish its current job first (Windows
      // has no signals, so it is asked with a message), then kills it after
      // kill_timeout ms.
      shutdown_with_message: true,
      kill_timeout: 120000,
    },
    {
      ...service,
      name: "excel-import-worker",
      script: "./workers/excelimport.worker.js",
      exec_mode: "fork",
      instances: EXCEL_WORKERS,
      node_args: [`--max-old-space-size=${EXCEL_HEAP_MB}`],
      // An import cut off half way is retried from the first row and inserts
      // the rows again, so a running import gets up to 10 minutes to finish.
      shutdown_with_message: true,
      kill_timeout: 600000,
    },
    {
      ...common,
      // pm2-logrotate needs internet to install; this does the same offline.
      // Runs once an hour and exits, so `pm2 ls` shows it as "stopped".
      name: "log-rotate",
      script: "./scripts/rotate-logs.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: false,
      cron_restart: "0 * * * *",
    },
  ],
};
