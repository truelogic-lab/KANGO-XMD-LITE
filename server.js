const express = require('express');
const path = require('path');

// Your original bot entry (obfuscated)
require('./index.js');

const app = express();

// JSON body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount our pairing API
const apiRouter = require('./api.js');
app.use('/api', apiRouter);

// Serve static files if your bot uses them (optional but safe)
const publicPath = path.join(__dirname, 'public');
try {
  if (require('fs').existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }
} catch {}

// Fallback root route (your status page is already served by index.js,
// but this ensures something responds if needed)
app.get('/', (req, res) => {
  res.send('KANGO-XMD-LITE is running. Use POST /api/connect to get a pairing code.');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
