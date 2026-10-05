-- ---------------------------------------------------------------------------
-- TrustFall / NewtBug Task-Manager — MySQL seed
-- Mirrors the exact data on the reference deployment (10.10.30.55): the `userdb`
-- database, the local app user `john`, and the 5 users + 10 tasks.
-- Passwords are stored in plaintext (the app compares plaintext) and match
-- scripts/resetPasswords.py so the shutdown reset restores these same values.
-- Re-runnable: it truncates and re-inserts the seed rows.
--
-- Usage:  sudo mysql < scripts/seed.sql
-- ---------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS userdb
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'john'@'localhost' IDENTIFIED BY 'johnPassword!@#$%';
GRANT ALL PRIVILEGES ON userdb.* TO 'john'@'localhost';
FLUSH PRIVILEGES;

USE userdb;

-- Schema (matches the reference server) -------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  isAdmin TINYINT(1) NOT NULL DEFAULT 0,
  resetToken VARCHAR(255) DEFAULT NULL,
  resetTokenExpiry DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY username (username),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id INT NOT NULL AUTO_INCREMENT,
  userID INT NOT NULL,
  task VARCHAR(255) NOT NULL,
  assigned TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY userID (userID),
  CONSTRAINT tasks_ibfk_1 FOREIGN KEY (userID) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Clean slate (tasks first: FK to users) ------------------------------------
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE tasks;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- Users (id=1 john is the admin and the CSRF victim) -------------------------
INSERT INTO users (id, username, email, password, isAdmin) VALUES
  (1, 'john',    'john@newtbug.com',    'Z8ctUXdmoIxsgG0wqMWU', 1),
  (2, 'kevin',   'kevin@newtbug.com',   'dC9Zzr70eBBEBrC30JZn', 0),
  (3, 'ray',     'ray@newtbug.com',     '8dQNDAPGy0zipvqrpdZ8', 0),
  (4, 'camilla', 'camilla@newtbug.com', 'xQV57Bym4ySIkadGd6XF', 0),
  (5, 'olivia',  'olivia@newtbug.com',  'LIuckg3TaF0FbSVmALKF', 0);

-- Tasks (assigned=1 are team tasks shown on dashboards; status NULL = pending)
INSERT INTO tasks (id, userID, task, assigned, status) VALUES
  ( 8, 5, 'Refactor existing code module',       1, 'completed'),
  ( 9, 5, 'Review pull requests',                1, NULL),
  (10, 4, 'Fix CI/CD pipeline issues',           1, 'completed'),
  (11, 3, 'Update Jira / task board',            1, 'completed'),
  (12, 2, 'Investigate reported bugs',           1, NULL),
  (13, 2, 'Review security vulnerabilities',     1, 'completed'),
  (14, 4, 'Deploy changes to staging',           1, NULL),
  (15, 1, 'Check build and deployment status',   0, 'completed'),
  (16, 1, 'Submit timesheet',                    0, NULL),
  (17, 1, 'Review weekly performance metrics',   0, 'completed');
