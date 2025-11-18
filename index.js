const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const fs = require('fs'); // NUEVO: Necesario para guardar los números en un archivo

const app = express();

// --- SERVIDOR WEB (Para mantenerlo 24/7) ---
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send('🤖 Bot de Ventas Activo');
});
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});

// --- LÓGICA DEL BOT ---
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ["Bot Ventas", "Chrome", "1.0.0"],
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const remoteJid = m.key.remoteJid;
        const msgText = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || '';
        const texto = msgText.toLowerCase();

        // --- NUEVO: SISTEMA DE BIENVENIDA ---
        // 1. Definimos el archivo donde se guardan los clientes
        const archivoUsuarios = 'clientes_registrados.json';

        // 2. Si el archivo no existe, lo creamos vacío
        if (!fs.existsSync(archivoUsuarios)) {
            fs.writeFileSync(archivoUsuarios, JSON.stringify([]));
        }

        // 3. Leemos la lista de clientes
        const clientes = JSON.parse(fs.readFileSync(archivoUsuarios));

        // 4. Verificamos si el número YA existe en la lista
        // El "!remoteJid.includes('@g.us')" es para que NO mande bienvenida en grupos
        if (!clientes.includes(remoteJid) && !remoteJid.includes('@g.us')) {
            
            console.log(`🎉 Nuevo cliente detectado: ${remoteJid}`);

            // A) Enviamos el mensaje de bienvenida automático
            await sock.sendMessage(remoteJid, {
                image: { url: 'https://i.imgur.com/P8j0w8M.jpeg' }, // Puedes cambiar la imagen
                caption: `👋 *¡Hola! Bienvenido a nuestra tienda.*\n\nSoy tu asistente virtual. Veo que es la primera vez que nos escribes.\n\nAquí tienes nuestro menú para empezar:\n\n🛍️ *!catalogo* - Ver productos\n📍 *!ubicacion* - Dónde estamos\n💰 *!promo* - Ofertas`
            });

            // B) Guardamos al cliente en la lista para no volver a saludarlo así
            clientes.push(remoteJid);
            fs.writeFileSync(archivoUsuarios, JSON.stringify(clientes));

            return; // Detenemos aquí para que no responda nada más por ahora
        }
        // --- FIN DEL SISTEMA DE BIENVENIDA ---


        // --- RESPUESTAS NORMALES (Para clientes que ya conocemos) ---
        
        if (texto.includes('hola') || texto === '!menu') {
            await sock.sendMessage(remoteJid, { 
                text: `🏢 *MENÚ PRINCIPAL*\n\nElige una opción:\n\n📦 *!catalogo* - Ver productos\n📍 *!ubicacion* - Dirección\n📞 *!asesor* - Hablar con humano`
            });
        }

        else if (texto === '!catalogo') {
            await sock.sendMessage(remoteJid, { 
                image: { url: 'https://i.imgur.com/P8j0w8M.jpeg' }, 
                caption: '👟 *Nuevas Zapatillas*\nPrecio: $50.00\n\nEscribe *!comprar* para pedir las tuyas.'
            });
        }

        else if (texto === '!ubicacion') {
            await sock.sendMessage(remoteJid, { 
                text: '📍 Nos encontramos en el Centro de la Ciudad.'
            });
        }
        
        else if (texto === '!asesor') {
            await sock.sendMessage(remoteJid, { 
                text: '⏳ Un humano te atenderá en breve.'
            });
        }
    });
}

connectToWhatsApp();
