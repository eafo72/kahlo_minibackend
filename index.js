const fs = require('fs');
const https = require('https');
const express = require("express");
const cors = require("cors");
const path = require('path');
const db = require('./config/db')
const axios = require("axios");

const dgram = require("dgram");

const app = express();
app.use(cors());
app.use(express.json());


const UDP_IP = "192.168.100.222";
const UDP_PORT = 2022;
const udpClient = dgram.createSocket("udp4");

//servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')))

//recibe codigo de la tablet
app.post("/enviar-boleto", (req, res) => {
  const { idReservacion } = req.body;
  if (!idReservacion) return res.status(400).send("Falta idReservacion");

  const mensaje = Buffer.from(`#${idReservacion}`);
  udpClient.send(mensaje, UDP_PORT, UDP_IP, (err) => {
    if (err) {
      console.error("Error enviando UDP:", err);
      return res.status(500).send("Error enviando UDP");
    }
    console.log("UDP enviado:", mensaje.toString());
    res.json({ ok: true, msg: "UDP enviado" });
  });
});


// Configuración del MinMoe
const MINMOE_IP = "192.168.100.99";   // IP del MinMoe
const MINMOE_USER = "admin";         // Usuario
const MINMOE_PASS = "kahlo$2025"; 

// Función para abrir el torniquete
async function abrirTorniquete() {
  const url = `http://${MINMOE_IP}/ISAPI/AccessControl/RemoteControl/door/1`;

  try {
    const response = await axios.post(
      url,
      '<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>',
      {
        headers: { "Content-Type": "application/xml" },
        auth: { username: MINMOE_USER, password: MINMOE_PASS },
        timeout: 3000
      }
    );
    console.log("✅ Torniquete abierto:", response.status);
  } catch (err) {
    console.error("❌ Error al abrir el torniquete:", err.message);
  }
}

//recibe codigo de la camara de la entrada
app.post("/enviar-qr", async (req, res) => {
  try {
    console.log("Evento recibido:", req.body);

    // Dependiendo del firmware, puede venir en cardNo o QRString
    const codigoQR = req.body?.CardNo?.[0] || req.body?.QRString;

    if (!codigoQR) {
      return res.status(400).send("QR no encontrado en payload");
    }

    console.log("🔑 QR leído:", codigoQR);

    // Buscar en base de datos
    const [rows] = await db.pool.query(
      "SELECT * FROM venta WHERE id_reservacion = ?",
      [codigoQR]
    );

    if (rows.length > 0) {
      console.log("✅ QR válido, abriendo torniquete...");
      await abrirTorniquete();
      res.json({ error: false, msg: "Acceso permitido" });
    } else {
      console.log("❌ QR inválido");
      res.json({ error: false, msg: "Codigo QR inválido, acceso denegado" });
    }
  } catch (err) {
    console.error("❌ Error interno:", err.message);
    res.status(500).send("Error interno");
  }
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, msg: "pong", ip: req.ip, time: new Date().toISOString() });
});

//app.get('/', (req, res) => res.send('KAHLO MINIBACKEND'))

// Ruta catch-all: si no coincide con ninguna API, mandar index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/*
// Iniciar servidor
app.listen(3000, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:3000`);
});
*/

// Cargar certificados SSL
const options = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
};

// Iniciar servidor HTTPS
https.createServer(options, app).listen(3000, '0.0.0.0', () => {
  console.log(`Servidor HTTPS corriendo en https://0.0.0.0:3000`);
});
