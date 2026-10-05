// require("dotenv").config();
// const mysql = require("mysql2");

// // Force local-only connection (127.0.0.1)
// const HOST = "127.0.0.1";

// // Create a connection to the database
// const connection = mysql.createConnection({
//   host: HOST,
//   user: process.env.DB_USER,
//   password: "johnPassword!@#$%", // Use env var instead of hardcoded
//   database: process.env.DB_NAME,
//   flags: ["FOUND_ROWS"],
// });

// // Connect to the database
// connection.connect((err) => {
//   if (err) {
//     console.error("Error connecting to the database:", err);
//     return;
//   }
//   console.log("Connected to MySQL database on localhost (127.0.0.1)");
// });

// const createTableQuery = `
// CREATE TABLE IF NOT EXISTS users (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     username VARCHAR(100) NOT NULL UNIQUE,
//     email VARCHAR(100) NOT NULL UNIQUE,
//     password VARCHAR(255) NOT NULL,
//     isAdmin TINYINT(1) NOT NULL DEFAULT 0,
//     resetToken VARCHAR(255),
//     resetTokenExpiry DATETIME
// );`;

// const createTasksTableQuery = `
// CREATE TABLE IF NOT EXISTS tasks (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     userID INT NOT NULL,
//     task VARCHAR(255) NOT NULL,
//     FOREIGN KEY (userID) REFERENCES users(id) ON DELETE CASCADE,
//     assigned TINYINT(1) NOT NULL DEFAULT 0,
//     status VARCHAR(255) NULL
// );`;

// connection.query(createTableQuery, (err) => {
//   if (err) {
//     console.error("Error creating users table:", err);
//   } else {
//     console.log("Users table ready!");
//     // Create tasks table after users table
//     connection.query(createTasksTableQuery, (err) => {
//       if (err) {
//         console.error("Error creating tasks table:", err);
//       } else {
//         console.log("Tasks table ready!");
//       }
//     });
//   }
// });

// module.exports = connection;
require("dotenv").config();
const mysql = require("mysql2");
const log = require("./logger");

// Force local-only connection (127.0.0.1)
const HOST = "127.0.0.1";

// ---------------------------------------------------------------------------
// Connection pool
//
// A pool (not a single connection) is used deliberately: on a cold boot
// MariaDB may not be ready when this process starts, and idle connections can
// be dropped by the server. A pool transparently re-establishes connections,
// so a dropped/reset link no longer wedges every subsequent query (which was
// the root cause of the "works only after a reboot" CSRF failure).
// ---------------------------------------------------------------------------
const pool = mysql.createPool({
  host: HOST,
  user: process.env.DB_USER,
  password: "johnPassword!@#$%", // Use env var instead of hardcoded
  database: process.env.DB_NAME,
  flags: ["FOUND_ROWS"],
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

log.info(`MySQL pool created (host=${HOST}, db=${process.env.DB_NAME}).`);

// Surface pool-level lifecycle events instead of letting them crash the app.
pool.on("connection", () => {
  log.debug("New DB connection established in pool.");
});
pool.on("acquire", (conn) => {
  log.debug(`DB connection ${conn.threadId} acquired from pool.`);
});
pool.on("release", (conn) => {
  log.debug(`DB connection ${conn.threadId} released back to pool.`);
});
pool.on("error", (err) => {
  // Pool errors (e.g. server going away) are logged; the pool will create a
  // fresh connection on the next query.
  log.error("DB pool error:", err);
});

const createTableQuery = `
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    isAdmin TINYINT(1) NOT NULL DEFAULT 0,
    resetToken VARCHAR(255),
    resetTokenExpiry DATETIME
);`;

const createTasksTableQuery = `
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userID INT NOT NULL,
    task VARCHAR(255) NOT NULL,
    FOREIGN KEY (userID) REFERENCES users(id) ON DELETE CASCADE,
    assigned TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(255) NULL
);`;

function ensureTables() {
  pool.query(createTableQuery, (err) => {
    if (err) {
      log.error("Error creating users table:", err);
      return;
    }
    log.info("Users table ready.");
    pool.query(createTasksTableQuery, (err) => {
      if (err) {
        log.error("Error creating tasks table:", err);
        return;
      }
      log.info("Tasks table ready.");
    });
  });
}

// ---------------------------------------------------------------------------
// Startup readiness: ping the DB in a loop until it answers, THEN ensure the
// schema exists. This rides out the window where MariaDB is still starting on
// a cold boot, instead of failing fatally and forcing a service restart.
// ---------------------------------------------------------------------------
const MAX_CONNECT_ATTEMPTS = 30;
const CONNECT_RETRY_DELAY_MS = 2000;

function connectWithRetry(attempt = 1) {
  pool.getConnection((err, conn) => {
    if (err) {
      log.warn(
        `DB not ready (attempt ${attempt}/${MAX_CONNECT_ATTEMPTS}): ${err.code || err.message}`,
      );
      if (attempt >= MAX_CONNECT_ATTEMPTS) {
        log.error(
          "Could not reach the database after maximum attempts. " +
            "The pool will keep retrying on demand, but startup schema setup is skipped.",
        );
        return;
      }
      setTimeout(() => connectWithRetry(attempt + 1), CONNECT_RETRY_DELAY_MS);
      return;
    }

    conn.ping((pingErr) => {
      conn.release();
      if (pingErr) {
        log.warn(
          `DB ping failed (attempt ${attempt}/${MAX_CONNECT_ATTEMPTS}): ${pingErr.message}`,
        );
        if (attempt >= MAX_CONNECT_ATTEMPTS) {
          log.error("DB ping never succeeded; skipping startup schema setup.");
          return;
        }
        setTimeout(() => connectWithRetry(attempt + 1), CONNECT_RETRY_DELAY_MS);
        return;
      }
      log.info(`Connected to MySQL database on ${HOST} (attempt ${attempt}).`);
      ensureTables();
    });
  });
}

connectWithRetry();

module.exports = pool;