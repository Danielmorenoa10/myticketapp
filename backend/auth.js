const jwt = require('jsonwebtoken');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitickets-clave-desarrollo-cambiar-en-produccion';

function createToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No autenticado.' });

    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.active, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
      [payload.id]
    );
    if (!rows.length || !rows[0].active) return res.status(401).json({ message: 'Usuario no disponible.' });

    req.user = rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Sesión inválida o expirada.' });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tienes permisos para esta operación.' });
    }
    next();
  };
}

module.exports = { createToken, authMiddleware, allowRoles };
