module.exports = {
  apps: [
    {
      name: "app-server",
      script: "./server.js",
      instances: "max",
      exec_mode: "cluster",
    },
    {
      name: "geo-worker",
      script: "./workers/geoWorker.js",
      instances: 1, // keep this single unless you want multiple job consumers
    },
  ],
};
