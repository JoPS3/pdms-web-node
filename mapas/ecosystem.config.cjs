module.exports = {
  apps: [
    {
      name: 'pdms-mapas',
      script: 'src/server.js',
      watch: true,
      ignore_watch: ['node_modules', '.git', 'logs', 'tmp'],
      watch_delay: 500,
      env: {
        NODE_ENV: 'development',
        PORT: 6002
      }
    }
  ]
};
