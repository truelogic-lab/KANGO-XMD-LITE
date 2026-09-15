const express = require('express');
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeInMemoryStore,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  PHONENUMBER_MCC
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Simple in-memory map: phone -> { socket, code }
const activeSessions = new Map();

router.post('/connect', async (req, res) => {
  try {
    const { phone, server } = req.body || {};

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid phone number' });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return res.status(400).json({ error: 'Invalid phone number length' });
    }

    // Create a unique session dir per phone
    const sessionDir = path.join(__dirname, 'sessions', cleanPhone);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInConsole: false,
      browser: ['Warren-XMD', 'Chrome', 'Linux'],
      version: (await fetchLatestBaileysVersion()).version,
    });

    saveCreds();

    // Request pairing code
    const code = await sock.requestPairingCode(cleanPhone);

    // Store session so we can reuse/close if needed
    activeSessions.set(cleanPhone, { socket: sock, code, createdAt: Date.now() });

    // Auto-close session after 5 minutes if not used
    setTimeout(() => {
      const sess = activeSessions.get(cleanPhone);
      if (sess && sess.socket) {
        sess.socket.end(undefined);
        activeSessions.delete(cleanPhone);
      }
    }, 5 * 60 * 1000);

    res.json({ code });
  } catch (err) {
    console.error('Pairing error:', err);
    res.status(500).json({ error: 'Failed to generate pairing code' });
  }
});

module.exports = router;
