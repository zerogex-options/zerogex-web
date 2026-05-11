module.exports = {
  apps: [
    {
      name: 'zerogex-web',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      // Force PM2 to spawn the BFF with the Node binary the deploy step
      // selected. deploy/steps/040.pm2 resolves `nvm use 22 && which node`
      // and exports PM2_NODE_INTERPRETER before invoking `pm2 start`, so
      // the spawned process is always on Node 22 regardless of the
      // calling shell's PATH. node:sqlite (used by frontend/core/db.ts
      // for the auth DB) is missing on Node 20; without this pin the
      // BFF can silently spawn on Node 20 and every page renders 500
      // while /api/* still returns 200 (BFF route handlers don't touch
      // sqlite). When the env var is unset (e.g. local dev), PM2 falls
      // back to its default interpreter resolution.
      interpreter: process.env.PM2_NODE_INTERPRETER || undefined,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
