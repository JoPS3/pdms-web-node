module.exports = {
  apps: [
    {
      name: 'pdms-auth',
      script: 'npm',
      args: 'run start',
      interpreter: 'none',
      cwd: '/home/joao/Projects/node/pdms-web-node/auth',
      watch: true,
      ignore_watch: ['node_modules', '.git', 'logs', 'tmp', 'src/public/styles/style.css'],
      watch_delay: 500,
      env: {
        NODE_ENV: 'development',
        PORT: 6001,
        GATEWAY_VALIDATE_DEV: 'http://localhost:6000/pdms-new/validate-session',
        GATEWAY_ONEDRIVE_SETUP_DEV: 'http://localhost:6000/pdms-new/internal/onedrive/setup',
        GATEWAY_ONEDRIVE_STATUS_DEV: 'http://localhost:6000/pdms-new/internal/onedrive/status',
        GATEWAY_ONEDRIVE_CONNECT_DEV: 'http://localhost:6000/pdms-new/internal/onedrive/connect',
        GATEWAY_ONEDRIVE_DISCONNECT_DEV: 'http://localhost:6000/pdms-new/internal/onedrive/disconnect'
      }
    }
  ]
};
