//Importación de libreria SQL
const mysql = require('mysql2/promise');
require('dotenv').config();

const DBHOST = "kahlodatabase.cw94akqo4617.us-east-1.rds.amazonaws.com";
const DBUSER = "admin";
const DBPASSW = "x5mfwzZ4IkCgctN2qowk";
const DBNAME = "kahlo";

const pool = mysql.createPool({
  host: DBHOST,
  user: DBUSER,
  password: DBPASSW,
  port: 3306,
  database: DBNAME,
  waitForConnections: true,
  connectionLimit: 20,   // número máximo de conexiones activas
  maxIdle: 20,           // conexiones inactivas permitidas (igual que connectionLimit)
  idleTimeout: 60000,    // tiempo que una conexión inactiva se mantiene antes de cerrarse (en ms)
  queueLimit: 100,       // máximo número de peticiones en cola
  enableKeepAlive: true, // mantiene viva la conexión (útil en producción)
  keepAliveInitialDelay: 0 // sin retardo inicial para keep-alive
});

pool.on('connection', connection =>{
    connection.query('SET time_zone="-06:00";',err =>{
        if(err){
            console.log(err);
            return;
        }
    });
});


module.exports = { pool };