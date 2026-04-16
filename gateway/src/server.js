require('dotenv').config({ override: true });

const app = require('./app');
const sessionCleanupScheduler = require('./scheduler/session-cleanup');

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Gateway skeleton a correr em http://localhost:${PORT}`);
  
  // Iniciar scheduler de limpeza de sessões expiradas
  sessionCleanupScheduler.start();
});
