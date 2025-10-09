const express = require('express');
const multer = require('multer');
const { parseStringPromise } = require('xml2js');
const db = require('./config/db');
const axios = require("axios");

const app = express();
const upload = multer();

// --- Configuración MinMoe ---
const MINMOE_IP = "192.168.100.92";
const MINMOE_USER = "admin";
const MINMOE_PASS = "kahlo$2025";

// --- Endpoint principal ---
app.post('/enviar-qr', upload.none(), async (req, res) => {
  try {
    const rawData = req.body.AccessControllerEvent;
    if (!rawData) {
      return res.status(400).json({ ok: false, msg: "No se encontró evento en el body" });
    }

    // Detectar si es JSON o XML
    let event;
    if (rawData.trim().startsWith('{')) {
      event = JSON.parse(rawData);
    } else {
      event = await parseStringPromise(rawData, { explicitArray: false });
    }

    const data = event.AccessControllerEvent || event;
    const eventType = data.eventType;

    // Ignorar heartbeats
    if (eventType === 'HeartBeat') {
      return res.send({ ok: true, ignored: true });
    }

    // Extraer datos del evento
    const cardNo = data.cardNo || data.employeeNoString || data.QRString;
    const serialNo = data.serialNo;
    console.log('Número escaneado:', cardNo);
    console.log('Serial del evento:', serialNo);

    // Buscar en DB
    const [rows] = await db.pool.query("SELECT * FROM venta WHERE id_reservacion = ?", [cardNo]);

    if (rows.length > 0) {
      console.log("✅ QR válido, abriendo torniquete...");
      await validarAccesoRemoto(serialNo, "success");
      await abrirTorniquete();
      return res.json({ error: false, msg: "Acceso permitido" });
    } else {
      console.log("❌ QR inválido, no existe en DB");
      await validarAccesoRemoto(serialNo, "failed");
      return res.json({ error: true, msg: "Código QR inválido, acceso denegado" });
    }

  } catch (err) {
    console.error('Error procesando evento:', err);
    res.status(500).send({ ok: false, error: err.message });
  }
});

// --- Función para abrir el torniquete ---
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
    console.log("🚪 Torniquete abierto:", response.status);
  } catch (err) {
    console.error("❌ Error al abrir el torniquete:", err.message);
  }
}

// --- Función para validar acceso remoto (la del Postman) ---
async function validarAccesoRemoto(serialNo, resultado) {
  const url = `http://${MINMOE_IP}/ISAPI/AccessControl/remoteCheck?format=json`;
  try {
    const body = {
      RemoteCheck: {
        serialNo: Number(serialNo),
        checkResult: resultado // "success" o "failed"
      }
    };
    const response = await axios.put(url, body, {
      auth: { username: MINMOE_USER, password: MINMOE_PASS },
      headers: { "Content-Type": "application/json" },
      timeout: 3000
    });
    console.log(`📡 Validación de acceso enviada (${resultado}) →`, response.data);
  } catch (err) {
    console.error("⚠️ Error al validar acceso remoto:", err.message);
  }
}

app.listen(3000, () => console.log('Servidor corriendo en puerto 3000'));
