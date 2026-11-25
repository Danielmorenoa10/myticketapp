const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('./db');
const { createToken, authMiddleware, allowRoles } = require('./auth');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'Mitickets' }));

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.active, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (!rows.length || !rows[0].active) return res.status(401).json({ message: 'Credenciales incorrectas.' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Credenciales incorrectas.' });

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ token: createToken(safeUser), user: safeUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error interno al iniciar sesión.' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => res.json({ user: req.user }));

app.get('/api/catalogs', authMiddleware, async (req, res) => {
  try {
    const [[categories], [priorities], [statuses], [agents]] = await Promise.all([
      pool.query('SELECT id, name FROM categories ORDER BY id'),
      pool.query('SELECT id, name FROM priorities ORDER BY level'),
      pool.query('SELECT id, name FROM statuses ORDER BY id'),
      pool.query(`SELECT u.id, u.name, u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'Agente de soporte' AND u.active = TRUE ORDER BY u.name`)
    ]);
    res.json({ categories, priorities, statuses, agents });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No fue posible cargar los catálogos.' });
  }
});

function ticketVisibility(req) {
  if (req.user.role === 'Administrador') return { sql: '', params: [] };
  if (req.user.role === 'Agente de soporte') return { sql: ' AND (t.assigned_to = ? OR t.requester_id = ?)', params: [req.user.id, req.user.id] };
  return { sql: ' AND t.requester_id = ?', params: [req.user.id] };
}

app.get('/api/tickets', authMiddleware, async (req, res) => {
  try {
    const visibility = ticketVisibility(req);
    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.description, t.created_at, t.updated_at,
              u.name AS requester, a.name AS agent,
              c.name AS category, p.name AS priority, s.name AS status
       FROM tickets t
       JOIN users u ON u.id = t.requester_id
       LEFT JOIN users a ON a.id = t.assigned_to
       JOIN categories c ON c.id = t.category_id
       JOIN priorities p ON p.id = t.priority_id
       JOIN statuses s ON s.id = t.status_id
       WHERE 1=1 ${visibility.sql}
       ORDER BY t.created_at DESC`,
      visibility.params
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No fue posible consultar los tickets.' });
  }
});

app.get('/api/tickets/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const visibility = ticketVisibility(req);
    const [tickets] = await pool.query(
      `SELECT t.id, t.title, t.description, t.created_at, t.updated_at,
              t.requester_id, t.assigned_to,
              u.name AS requester, a.name AS agent,
              c.name AS category, p.name AS priority, s.name AS status
       FROM tickets t
       JOIN users u ON u.id = t.requester_id
       LEFT JOIN users a ON a.id = t.assigned_to
       JOIN categories c ON c.id = t.category_id
       JOIN priorities p ON p.id = t.priority_id
       JOIN statuses s ON s.id = t.status_id
       WHERE t.id = ? ${visibility.sql}`,
      [id, ...visibility.params]
    );
    if (!tickets.length) return res.status(404).json({ message: 'Ticket no encontrado o sin permisos.' });

    const [comments] = await pool.query(
      `SELECT c.id, c.content, c.created_at, u.name AS author, r.name AS role
       FROM comments c JOIN users u ON u.id = c.user_id JOIN roles r ON r.id = u.role_id
       WHERE c.ticket_id = ? ORDER BY c.created_at ASC`,
      [id]
    );
    res.json({ ticket: tickets[0], comments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No fue posible consultar el ticket.' });
  }
});

app.post('/api/tickets', authMiddleware, async (req, res) => {
  try {
    const { title, description, category_id, priority_id } = req.body;
    if (!title || !description || !category_id || !priority_id) {
      return res.status(400).json({ message: 'Título, descripción, categoría y prioridad son obligatorios.' });
    }
    const [[status]] = await pool.query("SELECT id FROM statuses WHERE name = 'Abierto'");
    const [result] = await pool.query(
      `INSERT INTO tickets (title, description, requester_id, category_id, priority_id, status_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title.trim(), description.trim(), req.user.id, category_id, priority_id, status.id]
    );
    res.status(201).json({ id: result.insertId, message: 'Ticket creado correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No fue posible crear el ticket.' });
  }
});

app.patch('/api/tickets/:id/status', authMiddleware, async (req, res) => {
  try {
    if (!['Administrador', 'Agente de soporte'].includes(req.user.role)) {
      return res.status(403).json({ message: 'El usuario no puede cambiar estados.' });
    }
    const id = Number(req.params.id);
    const { status_id } = req.body;
    const visibility = req.user.role === 'Administrador'
      ? { sql: '', params: [] }
      : { sql: ' AND t.assigned_to = ?', params: [req.user.id] };

    const [ticketRows] = await pool.query(`SELECT t.id FROM tickets t WHERE t.id = ? ${visibility.sql}`, [id, ...visibility.params]);
    if (!ticketRows.length) return res.status(404).json({ message: 'Ticket no encontrado o no está asignado a ti.' });

    await pool.query('UPDATE tickets SET status_id = ? WHERE id = ?', [status_id, id]);
    res.json({ message: 'Estado actualizado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No fue posible cambiar el estado.' });
  }
});

app.patch('/api/tickets/:id/assign', authMiddleware, async (req, res) => {
  try {
    if (!['Administrador', 'Agente de soporte'].includes(req.user.role)) {
      return res.status(403).json({ message: 'No tienes permisos para asignar tickets.' });
    }
    const id = Number(req.params.id);
    const agentId = Number(req.body.agent_id);
    const [agentRows] = await pool.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND r.name = 'Agente de soporte' AND u.active = TRUE`,
      [agentId]
    );
    if (!agentRows.length) return res.status(400).json({ message: 'Agente no válido.' });

    if (req.user.role === 'Agente de soporte') {
      const [current] = await pool.query('SELECT id FROM tickets WHERE id = ? AND assigned_to = ?', [id, req.user.id]);
      if (!current.length) return res.status(403).json({ message: 'Solo puedes reasignar tickets que tienes asignados.' });
    }

    await pool.query('UPDATE tickets SET assigned_to = ? WHERE id = ?', [agentId, id]);
    await pool.query('INSERT INTO ticket_assignments (ticket_id, agent_id, assigned_by) VALUES (?, ?, ?)', [id, agentId, req.user.id]);
    res.json({ message: 'Ticket asignado correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No fue posible asignar el ticket.' });
  }
});

app.post('/api/tickets/:id/comments', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ message: 'El comentario no puede estar vacío.' });

    const visibility = ticketVisibility(req);
    const [ticketRows] = await pool.query(`SELECT id FROM tickets t WHERE t.id = ? ${visibility.sql}`, [id, ...visibility.params]);
    if (!ticketRows.length) return res.status(404).json({ message: 'Ticket no encontrado o sin permisos.' });

    await pool.query('INSERT INTO comments (ticket_id, user_id, content) VALUES (?, ?, ?)', [id, req.user.id, content]);
    res.status(201).json({ message: 'Comentario agregado.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No fue posible agregar el comentario.' });
  }
});

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const condition = req.user.role === 'Administrador'
      ? { sql: '', params: [] }
      : req.user.role === 'Agente de soporte'
        ? { sql: ' WHERE t.assigned_to = ?', params: [req.user.id] }
        : { sql: ' WHERE t.requester_id = ?', params: [req.user.id] };

    const [rows] = await pool.query(
      `SELECT s.name AS status, COUNT(t.id) AS total
       FROM statuses s LEFT JOIN tickets t ON t.status_id = s.id ${condition.sql}
       GROUP BY s.id, s.name ORDER BY s.id`,
      condition.params
    );
    const total = rows.reduce((sum, item) => sum + Number(item.total), 0);
    res.json({ total, byStatus: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No fue posible cargar el dashboard.' });
  }
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Mitickets ejecutándose en http://localhost:${PORT}`);
});
