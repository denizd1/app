// Rotates the PM2 log files of the apps. pm2-logrotate cannot be installed on a
// server without internet, so this script does the same job. PM2 runs it every
// hour (the "log-rotate" app in ecosystem.config.js). By hand:
//   node scripts/rotate-logs.js
//
// A log file bigger than LOG_MAX_MB (default 20) is renamed to
// <name>__<YYYYMMDD-HHMMSS>.log and PM2 opens a new file. Rotated files older
// than LOG_KEEP_DAYS (default 14) are deleted.
const fs = require("fs");
const path = require("path");
const pm2 = require("pm2");

const MAX_BYTES = (Number(process.env.LOG_MAX_MB) || 20) * 1024 * 1024;
const KEEP_MS = (Number(process.env.LOG_KEEP_DAYS) || 14) * 24 * 3600 * 1000;
const ROTATED_NAME = /__\d{8}-\d{6}\.log$/;

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function fail(err) {
  console.error("Log rotation failed:", err);
  process.exitCode = 1;
  pm2.disconnect();
}

pm2.connect((err) => {
  if (err) return fail(err);
  pm2.list((err, apps) => {
    if (err) return fail(err);

    const logFiles = new Set();
    for (const app of apps) {
      const env = app.pm2_env || {};
      for (const file of [env.pm_out_log_path, env.pm_err_log_path]) {
        if (file && fs.existsSync(file)) logFiles.add(file);
      }
    }

    let rotated = 0;
    for (const file of logFiles) {
      try {
        if (fs.statSync(file).size < MAX_BYTES) continue;
        const { dir, name } = path.parse(file);
        fs.renameSync(file, path.join(dir, `${name}__${timestamp()}.log`));
        rotated++;
      } catch (e) {
        // e.g. the file is open in another program on Windows; next run retries
        console.error(`Could not rotate ${file}: ${e.message}`);
      }
    }

    let deleted = 0;
    for (const dir of new Set([...logFiles].map((f) => path.dirname(f)))) {
      for (const entry of fs.readdirSync(dir)) {
        if (!ROTATED_NAME.test(entry)) continue;
        const full = path.join(dir, entry);
        try {
          if (Date.now() - fs.statSync(full).mtimeMs > KEEP_MS) {
            fs.unlinkSync(full);
            deleted++;
          }
        } catch (e) {
          console.error(`Could not delete ${full}: ${e.message}`);
        }
      }
    }

    const finish = (err) => {
      if (err) return fail(err);
      console.log(`Rotated ${rotated} log file(s), deleted ${deleted} old one(s).`);
      pm2.disconnect();
    };
    // Make PM2 write to fresh files instead of the renamed ones.
    if (rotated > 0) pm2.reloadLogs(finish);
    else finish();
  });
});
