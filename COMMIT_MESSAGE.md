
feat: integrate comprehensive health monitoring endpoints

- Connect existing health-routes.ts to main server under /api prefix
- Add 5 new monitoring endpoints: /api/health, /api/health/detailed, /api/ready, /api/status, /api/metrics
- Update server startup logs to display all available health endpoints
- Enable proper monitoring and observability for MemeStream bot components

Resolves unused code issue while providing detailed system health insights including
queue status, Redis connectivity, browser health, and performance metrics.
