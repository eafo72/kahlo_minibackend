const express = require('express');
const multer = require('multer');
const { parseStringPromise } = require('xml2js');
const db = require('./config/db');
const axios = require("axios");
const DigestFetch = require("digest-fetch").default;



const app = express();
const upload = multer();
const path = require('path');

//servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')))

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

    // Obtener venta + fecha_ida
    const query = `
            SELECT v.*, vt.fecha_ida
            FROM venta AS v
            INNER JOIN viajeTour AS vt ON v.viajeTour_id = vt.id
            WHERE v.id_reservacion = ?;
        `;
    const [ventaResult] = await db.pool.query(query, [cardNo]);
    if (ventaResult.length === 0) {
      console.log("❌ QR INVALIDO no existe");
      await validarAccesoRemoto(serialNo, "failed");
      return res.json({ error: true, msg: "El id de reservacion no existe." });
    }

    const venta = ventaResult[0];
    const noBoletos = parseInt(venta.no_boletos);
    const checkinActual = venta.checkin || 0;
    const fechaIdaTourUTC = new Date(venta.fecha_ida);
    const now = new Date();
    const nowCDMX = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const fechaIdaTourCDMX = new Date(fechaIdaTourUTC.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));

    // VERIFICACIÓN DEL DÍA (comentada por ahora)
    if (nowCDMX.toDateString() !== fechaIdaTourCDMX.toDateString()) {
      console.log("❌ QR INVALIDO no corresponde la fecha");
      await validarAccesoRemoto(serialNo, "failed");
      return res.json({ error: true, msg: `Check-in solo permitido el día del tour (${fechaIdaTourCDMX.toLocaleDateString("es-MX")}).` });
    }

    if (checkinActual >= noBoletos) {
      console.log("❌ QR INVALIDO ya se han registrado todos los boletos");
      await validarAccesoRemoto(serialNo, "failed");
      return res.json({ error: true, msg: `No se puede hacer checkin. Ya se han registrado ${checkinActual} de ${noBoletos} boletos comprados.` });
    }

    const nuevoCheckin = checkinActual + 1;
    // Guardar fecha actual formateada (CDMX)
    let today = new Date();
    let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    let time = today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds();
    let fecha = date + ' ' + time;
    const queryUpdate = `
            UPDATE venta
            SET checkin = ?, updated_at = ?
            WHERE id_reservacion = ?;
        `;
    await db.pool.query(queryUpdate, [nuevoCheckin, fecha, cardNo]);

    console.log("✅ QR válido, abriendo torniquete...");
    await validarAccesoRemoto(serialNo, "success");
    return res.json({ error: false, msg: "Acceso permitido" });

  } catch (err) {
    console.error('Error procesando evento:', err);
    res.status(500).send({ ok: false, error: err.message });
  }
});


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
   
    const client = new DigestFetch(MINMOE_USER, MINMOE_PASS);

    const response = await client.fetch(url, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    console.log(`📡 Validación de acceso enviada` + JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("⚠️ Error al validar acceso remoto:", err.message);
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => console.log('Servidor corriendo en puerto 3000'));
