require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app = require('./app');

const PORT = process.env.PORT || 6003;

app.listen(PORT, () => {
  console.log(`Vendas server running on http://localhost:${PORT}`);
});
