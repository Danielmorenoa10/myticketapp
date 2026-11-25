const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  const users = [
    { name: 'Administrador Mitickets', email: 'admin@mytickets.com', password: 'Admin123*', role: 'Administrador' },
    { name: 'Agente Soporte', email: 'agente@mytickets.com', password: 'Agente123*', role: 'Agente de soporte' },
    { name: 'Usuario Demo', email: 'usuario@mytickets.com', password: 'Usuario123*', role: 'Usuario' }
  ];

  for (const user of users) {
    const [roleRows] = await pool.query('SELECT id FROM roles WHERE name = ?', [user.role]);
    const hash = await bcrypt.hash(user.password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role_id = VALUES(role_id), active = TRUE`,
      [user.name, user.email, hash, roleRows[0].id]
    );
  }

  console.log('Usuarios de prueba creados/actualizados:');
  console.log('admin@mytickets.com / Admin123*');
  console.log('agente@mytickets.com / Agente123*');
  console.log('usuario@mytickets.com / Usuario123*');
  await pool.end();
}

seed().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
