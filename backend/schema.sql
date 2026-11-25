CREATE DATABASE IF NOT EXISTS mitickets CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mitickets;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS priorities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE,
  level INT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  requester_id INT NOT NULL,
  category_id INT NOT NULL,
  priority_id INT NOT NULL,
  status_id INT NOT NULL,
  assigned_to INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ticket_requester FOREIGN KEY (requester_id) REFERENCES users(id),
  CONSTRAINT fk_ticket_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_ticket_priority FOREIGN KEY (priority_id) REFERENCES priorities(id),
  CONSTRAINT fk_ticket_status FOREIGN KEY (status_id) REFERENCES statuses(id),
  CONSTRAINT fk_ticket_agent FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ticket_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  agent_id INT NOT NULL,
  assigned_by INT NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignment_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_agent FOREIGN KEY (agent_id) REFERENCES users(id),
  CONSTRAINT fk_assignment_admin FOREIGN KEY (assigned_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comment_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT IGNORE INTO roles (name) VALUES ('Administrador'), ('Agente de soporte'), ('Usuario');
INSERT IGNORE INTO categories (name) VALUES ('Hardware'), ('Software'), ('Red'), ('Accesos'), ('Otro');
INSERT IGNORE INTO priorities (name, level) VALUES ('Baja', 1), ('Media', 2), ('Alta', 3), ('Crítica', 4);
INSERT IGNORE INTO statuses (name) VALUES ('Abierto'), ('En proceso'), ('Resuelto'), ('Cerrado');
