const fs = require('fs');
const https = require('https');
const express = require("express");
const cors = require("cors");
const path = require('path');

const dgram = require("dgram");

const app = express();
app.use(cors());
app.use(express.json());


const UDP_IP = "192.168.100.222";
const UDP_PORT = 2022;
const udpClient = dgram.createSocket("udp4");

//servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));

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
