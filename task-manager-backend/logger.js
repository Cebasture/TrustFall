"use strict";

/**
 * Lightweight, dependency-free logger.
 *
 * Writes every line to BOTH:
 *   1. the console (stdout / stderr) — captured by journald when run as a
 *      systemd service (`journalctl -u jsServer`), and
 *   2. a log file on disk for persistent inspection.
 *
 * Format matches the project's Python scripts:
 *   "YYYY-MM-DD HH:MM:SS - LEVEL - message {meta}"
 *
 * Log file location:
 *   - LOG_FILE env var, if set
 *   - /var/log/task-manager-backend.log, if writable
 *   - <cwd>/server.log as a fallback
 */

const fs = require("fs");
const path = require("path");

const LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };

// Minimum level to emit (DEBUG in dev, INFO in production).
const MIN_LEVEL =
  LEVELS[(process.env.LOG_LEVEL || "").toUpperCase()] ||
  (process.env.NODE_ENV === "production" ? LEVELS.INFO : LEVELS.DEBUG);

function resolveLogFile() {
  const candidates = [
    process.env.LOG_FILE,
    "/var/log/task-manager-backend.log",
    path.join(process.cwd(), "server.log"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      // Append-mode open creates the file if missing and verifies writability.
      fs.appendFileSync(candidate, "");
      return candidate;
    } catch (_) {
      // Try the next candidate.
    }
  }
  return null; // Console-only if nothing is writable.
}

const LOG_FILE = resolveLogFile();
let fileStream = null;
if (LOG_FILE) {
  try {
    fileStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  } catch (_) {
    fileStream = null;
  }
}

function timestamp() {
  // Local time, "YYYY-MM-DD HH:MM:SS".
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function formatMeta(meta) {
  if (meta.length === 0) return "";
  const parts = meta.map((m) => {
    if (m instanceof Error) return m.stack || m.message;
    if (typeof m === "object") {
      try {
        return JSON.stringify(m);
      } catch (_) {
        return String(m);
      }
    }
    return String(m);
  });
  return " " + parts.join(" ");
}

function emit(level, msg, meta) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const line = `${timestamp()} - ${level} - ${msg}${formatMeta(meta)}`;

  // Console (journald): warnings/errors to stderr, the rest to stdout.
  if (level === "ERROR" || level === "WARN") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }

  // File.
  if (fileStream) {
    try {
      fileStream.write(line + "\n");
    } catch (_) {
      // Never let logging crash the app.
    }
  }
}

module.exports = {
  debug: (msg, ...meta) => emit("DEBUG", msg, meta),
  info: (msg, ...meta) => emit("INFO", msg, meta),
  warn: (msg, ...meta) => emit("WARN", msg, meta),
  error: (msg, ...meta) => emit("ERROR", msg, meta),
  logFile: LOG_FILE,
};
