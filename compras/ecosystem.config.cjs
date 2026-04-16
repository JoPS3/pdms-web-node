module.exports = {
  apps: [
    {
      name: 'pdms-compras',
      script: 'npm',
      args: 'run start',
      interpreter: 'none',
      cwd: '/home/joao/Projects/node/pdms-web-node/compras',
      watch: true,
      ignore_watch: ['node_modules', '.git', 'logs', 'tmp', 'src/public/styles/style.css'],
      watch_delay: 500,
      env: {
        NODE_ENV: 'development',
        PORT: 6004,
        GATEWAY_VALIDATE_DEV: 'http://localhost:6000/pdms-new/validate-session'
      }
    }
  ]
};
