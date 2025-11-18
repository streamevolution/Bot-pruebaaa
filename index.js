const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@adiwajshing/baileys');
const P = require('pino');
const path = require('path');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    version,
  });

  sock.ev.on('creds.update', saveCreds);

  const greetedUsers = new Set();

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (!greetedUsers.has(sender)) {
      greetedUsers.add(sender);
      await sock.sendMessage(sender, { text: '¡Hola! Bienvenido a Revolution Botcito. ¿En qué puedo ayudarte hoy?' });
      return;
    }

    if (!messageContent) return;

    if (messageContent.startsWith('/productos')) {
      await sock.sendMessage(sender, {
        image: { url: path.join(__dirname, 'media', 'producto1.jpg') },
        caption: 'Producto 1 - $100
Producto 2 - $200
Más productos en nuestro catálogo.',
      });
    } else if (messageContent.startsWith('/ofertas')) {
      await sock.sendMessage(sender, {
        video: { url: path.join(__dirname, 'media', 'oferta.mp4') },
        caption: '¡Oferta especial del día! 20% de descuento en todos los productos.',
      });
    } else if (messageContent.startsWith('/contacto')) {
      await sock.sendMessage(sender, { text: 'Puedes contactarme al teléfono: +123456789
Correo: asesor@empresa.com' });
    } else {
      await sock.sendMessage(sender, { text: 'Comando no reconocido. Usa: /productos, /ofertas o /contacto.' });
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('Revolution Botcito conectado');
    }
  });
}

startBot();