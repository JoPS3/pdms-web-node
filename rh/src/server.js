require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app = require('./app');

const port = process.env.PORT || 6005;

app.listen(port, () => {
	console.log(`RH server running on http://localhost:${port}`);
});
