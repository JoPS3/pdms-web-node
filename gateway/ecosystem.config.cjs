module.exports = {
  apps: [
    {
      name: 'pdms-gateway',
      script: 'npm',
      args: 'run start:pm2',
      interpreter: 'none',
      cwd: '/home/joao/Projects/node/pdms-web-node/gateway',
      watch: true,
      ignore_watch: ['node_modules', '.git', 'logs', 'tmp', 'src/public/styles/app.css'],
      watch_delay: 500,
      env: {
        NODE_ENV: 'development',
        PORT: 6000
      }
    }
  ]
};
