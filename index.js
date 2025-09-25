const express = require("express");
const cors = require("cors");
const dgram = require("dgram");

const app = express();
app.use(cors());
app.use(express.json());

const UDP_IP = "192.168.100.222";
const UDP_PORT = 2022;
const udpClient = dgram.createSocket("udp4");

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

app.get('/', (req, res) => res.send('KAHLO MINIBACKEND'))

app.listen(3000, () =>
  console.log("Mini-backend corriendo en PC en puerto 3000")
);