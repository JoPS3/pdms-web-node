module.exports = {
  apps: [
    {
      name: 'pdms-mapas',
      script: 'npm',
      args: 'run start',
      interpreter: 'none',
      cwd: '/home/joao/Projects/node/pdms-web-node/mapas',
      watch: true,
      ignore_watch: ['node_modules', '.git', 'logs', 'tmp'],
      watch_delay: 500,
      env: {
        NODE_ENV: 'development',
        PORT: 6002,
        GATEWAY_VALIDATE_DEV: 'http://localhost:6000/pdms-new/validate-session'
      }
    }
  ]
};
