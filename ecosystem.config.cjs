module.exports = { // eslint-disable-line no-undef

      apps: [
        {
          name: "memestream-server",
          script: "dist/bot/core/server.js",
          instances: 1,
          exec_mode: "fork", // web as single instance
        },
        {
          name: "memestream-worker",
          script: "dist/worker.js",
          instances: 2,      // spin up 2 workers
          exec_mode: "fork",
        },
      ],
    };