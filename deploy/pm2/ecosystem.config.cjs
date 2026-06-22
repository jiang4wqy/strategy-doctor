module.exports = {
  apps: [
    {
      name: 'strategy-doctor',
      script: 'scripts/start-production.mjs',
      interpreter: 'node',
      cwd: '/opt/strategy-doctor',
      env: {
        STRATEGY_DOCTOR_ENV_FILE: '.env',
        NODE_ENV: 'production',
      },
      max_restarts: 5,
      restart_delay: 5000,
    },
  ],
};
