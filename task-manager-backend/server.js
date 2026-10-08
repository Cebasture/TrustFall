// require("dotenv").config();
// const os = require("os");
// const express = require("express");
// const bodyParser = require("body-parser");
// const session = require("express-session");
// const cookieParser = require("cookie-parser");
// const cors = require("cors");
// const crypto = require("crypto");
// const db = require("./db");
// const app = express();
// // const nodemailer = require("nodemailer");
// const pug = require("pug");
// const port = process.env.PORT;

// function getNonLoopbackIP() {
//   const nets = os.networkInterfaces();

//   for (const [iface, addresses] of Object.entries(nets)) {
//     // Skip loopback (lo)
//     if (iface === "lo") continue;

//     // Found the only other interface - return its IPv4
//     for (const addr of addresses) {
//       if (addr.family === "IPv4" && !addr.internal) {
//         console.log(`Using ${iface}: ${addr.address}`);
//         return addr.address;
//       }
//     }
//   }

//   throw new Error("No non-loopback IPv4 interface found");
// }

// // Usage
// const HOST = getNonLoopbackIP();

// app.use(
//   cors({
//     origin: ["http://" + HOST, "http://127.0.0.1"],
//     methods: ["GET", "POST"],
//     allowedHeaders: ["Content-Type", "x-csrf-token"],
//     credentials: true,
//   }),
// );

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.json());
// app.use(cookieParser());

// app.use(
//   session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: true,
//     cookie: {
//       httpOnly: true,
//       secure: false, // Set to true if using HTTPS
//       maxAge: 1000 * 60 * 60 * 2, // 1 hour
//       // domain: process.env.CORS_ORIGIN.split('://')[1].split(':')[0]
//     },
//   }),
// );

// function requireLogin(req, res, next) {
//   if (!req.cookies || !req.cookies["connect.sid"]) {
//     return res.status(403).json({ error: "Not authenticated" });
//   }
//   next();
// }

// function validateToken(req, res, next) {
//   // Generate a new token if one doesn't exist in the session
//   if (!req.session.csrfToken) {
//     req.session.csrfToken = crypto.randomBytes(32).toString("hex");
//   }
//   // For POST requests, validate the token
//   if (req.method === "POST") {
//     const tokenFromHeader = req.headers["x-csrf-token"];
//     console.log("Session token:", req.session.csrfToken);
//     if (!tokenFromHeader || tokenFromHeader !== req.session.csrfToken) {
//       return res.status(403).json({ error: "Invalid or missing CSRF token" });
//     }
//     // Regenerate the token after successful validation to prevent reuse
//     req.session.csrfToken = crypto.randomBytes(32).toString("hex");
//   }
//   next();
// }

// // CSRF Token Endpoint
// app.get("/api/csrf-token", (req, res) => {
//   console.log("CGDDFDSHJS", req.session.csrfToken);
//   if (!req.session.csrfToken) {
//     console.log("No CSRF token in session");
//     return res.status(401).json({ error: "No active session or CSRF token" });
//   }
//   res.json({ csrfToken: req.session.csrfToken });
// });

// // Routes
// app.post("/api/register", (req, res) => {
//   const { username, password, email } = req.body;
//   const query =
//     "INSERT INTO users (username, password, email) VALUES (?, ?, ?)";
//   db.query(query, [username, password, email], (err, result) => {
//     if (err) {
//       console.error(err);
//       if (err.code === "ER_DUP_ENTRY") {
//         return res.status(400).json({ error: "Email already registered" });
//       }
//       return res.status(500).json({ error: "Error registering user" });
//     }
//     res.json({ message: "User registered successfully" });
//   });
// });

// app.post("/api/login", (req, res) => {
//   const { email, password } = req.body;
//   const query = "SELECT * FROM users WHERE email = ? AND password = ?";
//   db.query(query, [email, password], (err, results) => {
//     if (err) {
//       return res.status(500).json({ error: "Error logging in" });
//     }
//     if (results.length === 0) {
//       return res.status(401).json({ error: "Invalid credentials" });
//     }
//     const user = results[0];
//     req.session.userID = user.id;
//     req.session.isAdmin = user.isAdmin;
//     req.session.csrfToken = crypto.randomBytes(32).toString("hex");
//     console.log(req.session.csrfToken, req.session);
//     req.session.save((err) => {
//       if (err) console.log("Session save error:", err);
//     });
//     const dashboard = user.isAdmin ? "admin" : "user";
//     res.json({ message: "Login successful", dashboard });
//   });
// });

// app.get("/api/me", requireLogin, (req, res) => {
//   console.log("Session ID:", req.session.id);
//   db.query(
//     "SELECT username, email, id, isAdmin FROM users WHERE id = ?",
//     [req.session.userID],
//     (err, rows) => {
//       if (err || rows.length === 0) {
//         return res.status(401).json({ error: "Invalid session" });
//       }
//       const user = rows[0];
//       const isAdmin = rows[0].isAdmin;
//       if (isAdmin == 1) {
//         return res.status(401).json({ error: "Not authorized" });
//       } else {
//         req.user = rows[0];
//         res.json({
//           username: user.username,
//           email: user.email,
//           role: user.isAdmin ? "admin" : "user",
//         });
//       }
//     },
//   );
// });

// app.get("/api/adminMe", requireLogin, (req, res) => {
//   db.query(
//     "SELECT username, email, id, isAdmin FROM users WHERE id = ?",
//     [req.session.userID],
//     (err, rows) => {
//       if (err || rows.length === 0) {
//         return res.status(401).json({ error: "Invalid session" });
//       }
//       const user = rows[0];
//       const isAdmin = rows[0].isAdmin;
//       if (isAdmin == 0) {
//         return res.status(401).json({ error: "Not authorized" });
//       } else {
//         req.user = rows[0];
//         res.json({
//           username: req.user.username,
//           email: req.user.email,
//           role: user.isAdmin ? "admin" : "user",
//         });
//       }
//     },
//   );
// });

// app.post("/api/change-password", requireLogin, (req, res) => {
//  const { newPassword } = req.body;
//  const userID = req.session.userID;

// No old-password check, no CSRF token. The password is changed for whoever
// owns the session cookie on THIS request — this is the CSRF sink. An
// attacker who gets the admin to submit this request (cross-site, hidden
// auto-submitting form) takes over the admin account without knowing any
// secret. Parameterized write, so no SQLi here either — the vuln is purely
// the missing CSRF protection.
//  if (!newPassword) {
//    return res.status(400).json({ error: "New password is required" });
//  }

//  db.query(
//    `UPDATE users SET password=? WHERE id=?`,
//    [newPassword, userID],
//    (uErr, result) => {
//      if (uErr) {
//        console.error("Update error:", uErr);
//        return res.status(500).json({ error: "Error updating password" });
//      }
//
//      console.log(
//        `UPDATE affected ${result.affectedRows} row(s), id=${userID}`,
//      );
//
//      if (result.affectedRows !== 1) {
//        return res.status(500).json({ error: "Error updating password" });
//      }
//
//      req.session.destroy((sErr) => {
//        if (sErr) {
//          console.error("Session destruction error:", sErr);
//          return res.status(500).json({ error: "Logout failed" });
//        }
//        res.clearCookie("connect.sid", { path: "/" });
//        console.log("Session destroyed and cookie cleared successfully.");
//        return res.json({ message: "Password updated successfully" });
//      });
//    },
//  );
//});

// app.post("/api/create-task", requireLogin, validateToken, (req, res) => {
//   const { username, task } = req.body;
//   if (!task) {
//     return res.status(400).json({ error: "Task is required" });
//   }
//   const getAdminQuery = "SELECT isAdmin FROM users WHERE id = ?";
//   db.query(getAdminQuery, [req.session.userID], (err, results) => {
//     if (err) {
//       console.error("Error querying user admin status:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     if (results.length === 0) {
//       return res.status(401).json({ error: "User not found" });
//     }
//     const isAdmin = results[0].isAdmin;
//     let assigned = 0;
//     let userID;
//     if (username) {
//       if (isAdmin !== 1) {
//         return res
//           .status(403)
//           .json({ error: "Only admins can assign tasks to other users" });
//       }
//       const getUserQuery = "SELECT id FROM users WHERE username = ?";
//       db.query(getUserQuery, [username], (err, results) => {
//         if (err) {
//           console.error("Error querying user:", err);
//           return res.status(500).json({ error: "Database error" });
//         }
//         if (results.length === 0) {
//           return res.status(404).json({ error: "User not found" });
//         }
//         userID = results[0].id;
//         assigned = 1;
//         const insertTaskQuery =
//           "INSERT INTO tasks (userID, task, assigned, status) VALUES (?, ?, ?, NULL)";
//         db.query(insertTaskQuery, [userID, task, assigned], (err, result) => {
//           if (err) {
//             console.error("Error inserting task:", err);
//             return res.status(500).json({ error: "Failed to create task" });
//           }
//           res.json({ message: "Task assigned successfully" });
//         });
//       });
//     } else {
//       userID = req.session.userID;
//       const insertTaskQuery =
//         "INSERT INTO tasks (userID, task, assigned, status) VALUES (?, ?, ?, NULL)";
//       db.query(insertTaskQuery, [userID, task, assigned], (err, result) => {
//         if (err) {
//           console.error("Error inserting task:", err);
//           return res.status(500).json({ error: "Failed to create task" });
//         }
//         res.json({ message: "Personal task created successfully" });
//       });
//     }
//   });
// });

// app.get("/api/export-csv", requireLogin, (req, res) => {
//   const { template } = req.query;

//   const query = `
//     SELECT t.id AS taskID, t.task, t.status, u.username AS assignedTo
//     FROM tasks t
//     JOIN users u ON t.userID = u.id
//     WHERE t.assigned = 1
//   `;

//   db.query(query, (err, tasks) => {
//     if (err) {
//       return res.status(500).json({ error: "Database error" });
//     }

//     // Default Pug template (safe)
//     const defaultTemplate =
//       template ||
//       `
// - tasks.forEach(task => {
//   = '"' + task.taskID + '","' + task.task + '","' + task.assignedTo + '"\\n'
// - })
// `;

//     try {
//       // Render Pug template (vulnerable if template contains JS)
//       const csvData = pug.render(defaultTemplate, { tasks, require });
//       res.setHeader("Content-Type", "text/csv");
//       res.setHeader("Content-Disposition", 'attachment; filename="tasks.csv"');
//       res.send(csvData);
//     } catch (error) {
//       if (!res.headersSent) {
//         console.log(error);
//         res.status(500).json({ error: "Template compilation error" });
//       } else {
//         console.error("Template error after headers sent:", error);
//       }
//     }
//   });
// });

// app.get("/api/get-tasks", requireLogin, (req, res) => {
//   const { assigned } = req.query;
//   if (assigned !== "0" && assigned !== "1") {
//     return res
//       .status(400)
//       .json({ error: "Invalid assigned parameter. Must be 0 or 1." });
//   }
//   const query =
//     "SELECT id, task, status FROM tasks WHERE userID = ? AND assigned = ?";
//   db.query(query, [req.session.userID, parseInt(assigned)], (err, results) => {
//     if (err) {
//       console.error("Error fetching tasks:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     const tasks = results.map((row) => ({
//       id: row.id,
//       task: row.task,
//       status: row.status,
//     }));
//     res.json({ tasks });
//   });
// });

// app.post("/api/delete-task", requireLogin, validateToken, (req, res) => {
//   const { taskId } = req.body;
//   if (!taskId) {
//     return res.status(400).json({ error: "Task ID is required" });
//   }
//   const checkQuery = "SELECT userID, assigned FROM tasks WHERE id = ?";
//   db.query(checkQuery, [taskId], (err, results) => {
//     if (err) {
//       console.error("Error checking task:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     if (results.length === 0) {
//       return res.status(404).json({ error: "Task not found" });
//     }
//     const task = results[0];
//     if (task.userID !== req.session.userID) {
//       return res
//         .status(403)
//         .json({ error: "Unauthorized: Task does not belong to you" });
//     }
//     if (task.assigned !== 0) {
//       return res.status(403).json({ error: "Cannot delete assigned tasks" });
//     }
//     const deleteQuery = "DELETE FROM tasks WHERE id = ?";
//     db.query(deleteQuery, [taskId], (err, result) => {
//       if (err) {
//         console.error("Error deleting task:", err);
//         return res.status(500).json({ error: "Failed to delete task" });
//       }
//       if (result.affectedRows === 0) {
//         return res.status(404).json({ error: "Task not found" });
//       }
//       res.json({ message: "Task deleted successfully" });
//     });
//   });
// });

// app.post("/api/mark-done", requireLogin, validateToken, (req, res) => {
//   const { taskId } = req.body;
//   if (!taskId) {
//     return res.status(400).json({ error: "Task ID is required" });
//   }
//   const checkQuery = "SELECT userID, assigned FROM tasks WHERE id = ?";
//   db.query(checkQuery, [taskId], (err, results) => {
//     if (err) {
//       console.error("Error checking task:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     if (results.length === 0) {
//       return res.status(404).json({ error: "Task not found" });
//     }
//     const task = results[0];
//     if (task.userID !== req.session.userID) {
//       return res
//         .status(403)
//         .json({ error: "Unauthorized: Task does not belong to you" });
//     }
//     if (task.assigned !== 1) {
//       return res
//         .status(403)
//         .json({ error: "Can only mark assigned tasks as done" });
//     }
//     const updateQuery = "UPDATE tasks SET status = 'completed' WHERE id = ?";
//     db.query(updateQuery, [taskId], (err, result) => {
//       if (err) {
//         console.error("Error updating task status:", err);
//         return res.status(500).json({ error: "Failed to mark task as done" });
//       }
//       if (result.affectedRows === 0) {
//         return res.status(404).json({ error: "Task not found" });
//       }
//       res.json({ message: "Task marked as done" });
//     });
//   });
// });

// app.get("/api/user-tasks", requireLogin, (req, res) => {
//   const query = `
//     SELECT t.id, t.task, t.status, u.username
//     FROM tasks t
//     JOIN users u ON t.userID = u.id
//     WHERE t.assigned = 1`;

//   db.query(query, (err, results) => {
//     if (err) {
//       console.error("Error fetching user tasks:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     if (results.length === 0) {
//       return res.json({ tasks: [] }); // Return empty array if no tasks
//     }
//     const tasks = results.map((row) => ({
//       id: row.id,
//       task: row.task,
//       username: row.username,
//       status: row.status,
//     }));
//     res.json({ tasks });
//   });
// });

// app.post("/api/logout", (req, res) => {
//   req.session.destroy((err) => {
//     if (err) {
//       console.error("Session destruction error:", err);
//       return res.status(500).json({ error: "Logout failed" });
//     }
//     res.clearCookie("connect.sid", {
//       sameSite: "none",
//       secure: false,
//     }); // Clear the session cookie (adjust name if different)
//     res.json({ message: "Logged out successfully" });
//   });
// });

// app.listen(port, "127.0.0.1", () => {
//   console.log(`Server running on ${port}`);
// });
require("dotenv").config();
const os = require("os");
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const crypto = require("crypto");
const db = require("./db");
const log = require("./logger");
const app = express();
// const nodemailer = require("nodemailer");
const pug = require("pug");
const port = process.env.PORT;

function getNonLoopbackIP() {
  const nets = os.networkInterfaces();

  for (const [iface, addresses] of Object.entries(nets)) {
    // Skip loopback (lo)
    if (iface === "lo") continue;

    // Found the only other interface - return its IPv4
    for (const addr of addresses) {
      if (addr.family === "IPv4" && !addr.internal) {
        log.info(`Using ${iface}: ${addr.address}`);
        return addr.address;
      }
    }
  }

  throw new Error("No non-loopback IPv4 interface found");
}

// Usage
const HOST = getNonLoopbackIP();

app.use(
  cors({
    origin: ["http://" + HOST, "http://127.0.0.1"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "x-csrf-token"],
    credentials: true,
  }),
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Request logger: one line per request, plus completion status/duration.
app.use((req, res, next) => {
  const start = Date.now();
  log.info(`--> ${req.method} ${req.originalUrl} from ${req.ip}`);
  res.on("finish", () => {
    log.info(
      `<-- ${req.method} ${req.originalUrl} ${res.statusCode} (${Date.now() - start}ms)`,
    );
  });
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS
      maxAge: 2 * 1000 * 60 * 60, // 1 hour
      // domain: process.env.CORS_ORIGIN.split('://')[1].split(':')[0]
    },
  }),
);

function requireLogin(req, res, next) {
  if (!req.cookies || !req.cookies["connect.sid"]) {
    log.warn(
      `requireLogin: blocked ${req.method} ${req.originalUrl} — no connect.sid cookie.`,
    );
    return res.status(403).json({ error: "Not authenticated" });
  }
  next();
}

function validateToken(req, res, next) {
  // Generate a new token if one doesn't exist in the session
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  // For POST requests, validate the token
  if (req.method === "POST") {
    const tokenFromHeader = req.headers["x-csrf-token"];
    log.debug(
      `validateToken: session token present=${!!req.session.csrfToken}, header token present=${!!tokenFromHeader}`,
    );
    if (!tokenFromHeader || tokenFromHeader !== req.session.csrfToken) {
      log.warn(
        `validateToken: rejected ${req.method} ${req.originalUrl} — invalid/missing CSRF token.`,
      );
      return res.status(403).json({ error: "Invalid or missing CSRF token" });
    }
    // Regenerate the token after successful validation to prevent reuse
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  next();
}

// CSRF Token Endpoint
app.get("/api/csrf-token", (req, res) => {
  if (!req.session.csrfToken) {
    log.warn("csrf-token: no active session or CSRF token.");
    return res.status(401).json({ error: "No active session or CSRF token" });
  }
  log.debug("csrf-token: issued token to session.");
  res.json({ csrfToken: req.session.csrfToken });
});

// Routes
app.post("/api/register", (req, res) => {
  const { username, password, email } = req.body;
  const query =
    "INSERT INTO users (username, password, email) VALUES (?, ?, ?)";
  db.query(query, [username, password, email], (err, result) => {
    if (err) {
      log.error("register: DB error:", err);
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ error: "Email already registered" });
      }
      return res.status(500).json({ error: "Error registering user" });
    }
    log.info(
      `register: new user created (username=${username}, email=${email}).`,
    );
    res.json({ message: "User registered successfully" });
  });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  log.info(`login: attempt for email=${email}.`);

  const query = "SELECT * FROM users WHERE email = ? AND password = ?";

  db.query(query, [email, password], (err, results) => {
    if (err) {
      log.error("login: DB error:", err);
      return res.status(500).json({ error: "Error logging in" });
    }

    if (results.length === 0) {
      log.warn(`login: invalid credentials for email=${email}.`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = results[0];

    // Important: destroy old/pre-login session and create a new session ID
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        log.error("login: session regeneration error:", regenErr);
        return res.status(500).json({ error: "Error logging in" });
      }

      req.session.userID = user.id;
      req.session.isAdmin = user.isAdmin;
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");

      req.session.save((saveErr) => {
        if (saveErr) {
          log.error("login: session save error:", saveErr);
          return res.status(500).json({ error: "Error logging in" });
        }

        const dashboard = user.isAdmin ? "admin" : "user";

        log.info(
          `login: success userID=${user.id}, isAdmin=${user.isAdmin}, fresh session generated.`,
        );

        return res.json({
          message: "Login successful",
          dashboard,
        });
      });
    });
  });
});

app.get("/api/me", requireLogin, (req, res) => {
  log.debug(`me: sid=${req.session.id}, userID=${req.session.userID}.`);
  db.query(
    "SELECT username, email, id, isAdmin FROM users WHERE id = ?",
    [req.session.userID],
    (err, rows) => {
      if (err || rows.length === 0) {
        log.warn(
          `me: invalid session (userID=${req.session.userID}).`,
          err || "",
        );
        return res.status(401).json({ error: "Invalid session" });
      }
      const user = rows[0];
      const isAdmin = rows[0].isAdmin;
      if (isAdmin == 1) {
        return res.status(401).json({ error: "Not authorized" });
      } else {
        req.user = rows[0];
        res.json({
          username: user.username,
          email: user.email,
          role: user.isAdmin ? "admin" : "user",
        });
      }
    },
  );
});

app.get("/api/adminMe", requireLogin, (req, res) => {
  db.query(
    "SELECT username, email, id, isAdmin FROM users WHERE id = ?",
    [req.session.userID],
    (err, rows) => {
      if (err || rows.length === 0) {
        log.warn(
          `adminMe: invalid session (userID=${req.session.userID}).`,
          err || "",
        );
        return res.status(401).json({ error: "Invalid session" });
      }
      const user = rows[0];
      const isAdmin = rows[0].isAdmin;
      if (isAdmin == 0) {
        return res.status(401).json({ error: "Not authorized" });
      } else {
        req.user = rows[0];
        res.json({
          username: req.user.username,
          email: req.user.email,
          role: user.isAdmin ? "admin" : "user",
        });
      }
    },
  );
});

app.post("/api/change-password", requireLogin, (req, res) => {
  const { newPassword } = req.body;
  const userID = req.session.userID;

  log.info(`change-password: sid=${req.session.id}, userID=${userID}.`);

  // The session is the only authority for WHOSE password changes — there is no
  // oldPassword check (by design for this lab). A missing userID means the
  // session has no logged-in user (e.g. the in-memory store was wiped by a
  // backend restart); without it we cannot target a row, so bail out loudly.
  if (userID === undefined || userID === null) {
    log.error(
      "change-password: no userID in session — cannot identify target user. " +
        "(Session likely missing/expired; check for backend restarts.)",
    );
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!newPassword) {
    log.warn("change-password: missing newPassword in request body.");
    return res.status(400).json({ error: "New password is required" });
  }

  // Parameterized: newPassword is a bound value and the target row comes from
  // the session (userID), so there is NO SQL injection surface. The vuln is
  // purely the missing CSRF protection (session cookie is the only authority).
  const query = "UPDATE users SET password = ? WHERE id = ?";
  log.info(`change-password: userID=${userID} (parameterized update).`);

  // A pool cannot run db.beginTransaction directly — grab one connection so the
  // whole transaction runs on a single link, then release it.
  db.getConnection((connErr, conn) => {
    if (connErr) {
      log.error("change-password: could not get DB connection:", connErr);
      return res.status(500).json({ error: "Error updating password" });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        log.error("change-password: TX begin error:", txErr);
        conn.release();
        return res.status(500).json({ error: "Error updating password" });
      }

      conn.query(query, [newPassword, userID], (err, result) => {
        if (err) {
          log.error("change-password: SQL error:", err);
          return conn.rollback(() => {
            conn.release();
            res.status(500).json({ error: "Error updating password" });
          });
        }

        // Parameterized query + PK match -> affectedRows is 0 or 1.
        //   0 -> no such user (bad/expired session); 1 -> the intended change.
        if (result.affectedRows !== 1) {
          log.warn(
            `change-password: no rows updated (userID=${userID} not found).`,
          );
          return conn.rollback(() => {
            conn.release();
            res.status(401).json({ error: "No active session" });
          });
        }

        conn.commit((commitErr) => {
          if (commitErr) {
            log.error("change-password: commit error:", commitErr);
            return conn.rollback(() => {
              conn.release();
              res.status(500).json({ error: "Error updating password" });
            });
          }
          conn.release();
          log.info(
            `change-password: password updated for userID=${userID} (1 row).`,
          );

          req.session.destroy((sErr) => {
            if (sErr) {
              log.error("change-password: session destruction error:", sErr);
              return res.status(500).json({ error: "Logout failed" });
            }
            res.clearCookie("connect.sid", { path: "/" });
            log.info("change-password: session destroyed and cookie cleared.");
            return res.json({ message: "Password updated successfully" });
          });
        });
      });
    });
  });
});

app.post("/api/create-task", requireLogin, validateToken, (req, res) => {
  const { username, task } = req.body;
  if (!task) {
    return res.status(400).json({ error: "Task is required" });
  }
  const getAdminQuery = "SELECT isAdmin FROM users WHERE id = ?";
  db.query(getAdminQuery, [req.session.userID], (err, results) => {
    if (err) {
      log.error("create-task: error querying user admin status:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      log.warn(`create-task: user not found (userID=${req.session.userID}).`);
      return res.status(401).json({ error: "User not found" });
    }
    const isAdmin = results[0].isAdmin;
    let assigned = 0;
    let userID;
    if (username) {
      if (isAdmin !== 1) {
        log.warn(
          `create-task: non-admin userID=${req.session.userID} tried to assign task.`,
        );
        return res
          .status(403)
          .json({ error: "Only admins can assign tasks to other users" });
      }
      const getUserQuery = "SELECT id FROM users WHERE username = ?";
      db.query(getUserQuery, [username], (err, results) => {
        if (err) {
          log.error("create-task: error querying target user:", err);
          return res.status(500).json({ error: "Database error" });
        }
        if (results.length === 0) {
          log.warn(`create-task: target username not found (${username}).`);
          return res.status(404).json({ error: "User not found" });
        }
        userID = results[0].id;
        assigned = 1;
        const insertTaskQuery =
          "INSERT INTO tasks (userID, task, assigned, status) VALUES (?, ?, ?, NULL)";
        db.query(insertTaskQuery, [userID, task, assigned], (err, result) => {
          if (err) {
            log.error("create-task: error inserting assigned task:", err);
            return res.status(500).json({ error: "Failed to create task" });
          }
          log.info(
            `create-task: task assigned to userID=${userID} by admin userID=${req.session.userID}.`,
          );
          res.json({ message: "Task assigned successfully" });
        });
      });
    } else {
      userID = req.session.userID;
      const insertTaskQuery =
        "INSERT INTO tasks (userID, task, assigned, status) VALUES (?, ?, ?, NULL)";
      db.query(insertTaskQuery, [userID, task, assigned], (err, result) => {
        if (err) {
          log.error("create-task: error inserting personal task:", err);
          return res.status(500).json({ error: "Failed to create task" });
        }
        log.info(`create-task: personal task created for userID=${userID}.`);
        res.json({ message: "Personal task created successfully" });
      });
    }
  });
});

app.get("/api/export-csv", requireLogin, (req, res) => {
  const { template } = req.query;

  const query = `
    SELECT t.id AS taskID, t.task, t.status, u.username AS assignedTo
    FROM tasks t 
    JOIN users u ON t.userID = u.id 
    WHERE t.assigned = 1
  `;

  db.query(query, (err, tasks) => {
    if (err) {
      log.error("export-csv: DB error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    // Default Pug template (safe)
    const defaultTemplate =
      template ||
      `
- tasks.forEach(task => {
  = '"' + task.taskID + '","' + task.task + '","' + task.assignedTo + '"\\n'
- })
`;

    log.info(
      `export-csv: rendering ${tasks.length} tasks (customTemplate=${!!template}).`,
    );
    try {
      // Render Pug template (vulnerable if template contains JS)
      const csvData = pug.render(defaultTemplate, { tasks, require });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="tasks.csv"');
      res.send(csvData);
    } catch (error) {
      if (!res.headersSent) {
        log.error("export-csv: template compilation error:", error);
        res.status(500).json({ error: "Template compilation error" });
      } else {
        log.error("export-csv: template error after headers sent:", error);
      }
    }
  });
});

app.get("/api/get-tasks", requireLogin, (req, res) => {
  const { assigned } = req.query;
  if (assigned !== "0" && assigned !== "1") {
    return res
      .status(400)
      .json({ error: "Invalid assigned parameter. Must be 0 or 1." });
  }
  const query =
    "SELECT id, task, status FROM tasks WHERE userID = ? AND assigned = ?";
  db.query(query, [req.session.userID, parseInt(assigned)], (err, results) => {
    if (err) {
      log.error("get-tasks: error fetching tasks:", err);
      return res.status(500).json({ error: "Database error" });
    }
    const tasks = results.map((row) => ({
      id: row.id,
      task: row.task,
      status: row.status,
    }));
    res.json({ tasks });
  });
});

app.post("/api/delete-task", requireLogin, validateToken, (req, res) => {
  const { taskId } = req.body;
  if (!taskId) {
    return res.status(400).json({ error: "Task ID is required" });
  }
  const checkQuery = "SELECT userID, assigned FROM tasks WHERE id = ?";
  db.query(checkQuery, [taskId], (err, results) => {
    if (err) {
      log.error("delete-task: error checking task:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const task = results[0];
    if (task.userID !== req.session.userID) {
      log.warn(
        `delete-task: userID=${req.session.userID} tried to delete task ${taskId} owned by ${task.userID}.`,
      );
      return res
        .status(403)
        .json({ error: "Unauthorized: Task does not belong to you" });
    }
    if (task.assigned !== 0) {
      return res.status(403).json({ error: "Cannot delete assigned tasks" });
    }
    const deleteQuery = "DELETE FROM tasks WHERE id = ?";
    db.query(deleteQuery, [taskId], (err, result) => {
      if (err) {
        log.error("delete-task: error deleting task:", err);
        return res.status(500).json({ error: "Failed to delete task" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Task not found" });
      }
      log.info(
        `delete-task: task ${taskId} deleted by userID=${req.session.userID}.`,
      );
      res.json({ message: "Task deleted successfully" });
    });
  });
});

app.post("/api/mark-done", requireLogin, validateToken, (req, res) => {
  const { taskId } = req.body;
  if (!taskId) {
    return res.status(400).json({ error: "Task ID is required" });
  }
  const checkQuery = "SELECT userID, assigned FROM tasks WHERE id = ?";
  db.query(checkQuery, [taskId], (err, results) => {
    if (err) {
      log.error("mark-done: error checking task:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const task = results[0];
    if (task.userID !== req.session.userID) {
      log.warn(
        `mark-done: userID=${req.session.userID} tried to mark task ${taskId} owned by ${task.userID}.`,
      );
      return res
        .status(403)
        .json({ error: "Unauthorized: Task does not belong to you" });
    }
    if (task.assigned !== 1) {
      return res
        .status(403)
        .json({ error: "Can only mark assigned tasks as done" });
    }
    const updateQuery = "UPDATE tasks SET status = 'completed' WHERE id = ?";
    db.query(updateQuery, [taskId], (err, result) => {
      if (err) {
        log.error("mark-done: error updating task status:", err);
        return res.status(500).json({ error: "Failed to mark task as done" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Task not found" });
      }
      log.info(
        `mark-done: task ${taskId} marked done by userID=${req.session.userID}.`,
      );
      res.json({ message: "Task marked as done" });
    });
  });
});

app.get("/api/user-tasks", requireLogin, (req, res) => {
  const query = `
    SELECT t.id, t.task, t.status, u.username 
    FROM tasks t 
    JOIN users u ON t.userID = u.id 
    WHERE t.assigned = 1`;

  db.query(query, (err, results) => {
    if (err) {
      log.error("user-tasks: error fetching user tasks:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.json({ tasks: [] }); // Return empty array if no tasks
    }
    const tasks = results.map((row) => ({
      id: row.id,
      task: row.task,
      username: row.username,
      status: row.status,
    }));
    res.json({ tasks });
  });
});

app.post("/api/logout", (req, res) => {
  const sid = req.session.id;
  req.session.destroy((err) => {
    if (err) {
      log.error("logout: session destruction error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid", {
      path: "/"
      //sameSite: "none",
      //secure: false,
    }); // Clear the session cookie (adjust name if different)
    log.info(`logout: session ${sid} destroyed.`);
    res.json({ message: "Logged out successfully" });
  });
});

app.listen(port, "127.0.0.1", () => {
  log.info(
    `Server running on ${HOST}:${port} (NODE_ENV=${process.env.NODE_ENV || "development"}).`,
  );
});

// Last-resort handlers so crashes are captured in the log/journal rather than
// vanishing — useful for diagnosing the cold-boot failure mode.
process.on("uncaughtException", (err) => {
  log.error("uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  log.error("unhandledRejection:", reason);
});
