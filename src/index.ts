import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: 'postgresql://postgres:Ahorro2026*@db.vpsyopdksbcgpepdcfjw.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

// --- SOCIOS ---
app.get('/api/socios', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM socios ORDER BY numero ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/socios', async (req, res) => {
  try {
    const { numero, nombres, apellidos, email } = req.body;
    const result = await pool.query(
      'INSERT INTO socios (numero, nombres, apellidos, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [numero, nombres, apellidos, email || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- PLANES DE AHORRO ---
app.get('/api/planes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM planes_ahorro ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/planes', async (req, res) => {
  try {
    const { socio_id, nombre, plazo_meses, monto_objetivo, monto_inicial } = req.body;
    const inicial = Number(monto_inicial || 0);

    const result = await pool.query(
      'INSERT INTO planes_ahorro (socio_id, nombre, plazo_meses, monto_objetivo, monto_ahorrado) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [socio_id, nombre, plazo_meses || 18, monto_objetivo || 0, inicial]
    );

    const nuevoPlan = result.rows[0];

    if (inicial > 0) {
      await pool.query(
        'INSERT INTO aportes (plan_id, tipo, monto, detalle) VALUES ($1, $2, $3, $4)',
        [nuevoPlan.id, 'aporte', inicial, 'Depósito inicial de apertura']
      );
    }

    res.status(201).json(nuevoPlan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- MOVIMIENTOS ---
app.post('/api/movimientos', async (req, res) => {
  try {
    const { plan_id, tipo, monto, detalle } = req.body;
    await pool.query(
      'INSERT INTO aportes (plan_id, tipo, monto, detalle) VALUES ($1, $2, $3, $4)',
      [plan_id, tipo, monto, detalle]
    );

    const multiplicador = tipo === 'aporte' ? 1 : -1;
    const updateResult = await pool.query(
      'UPDATE planes_ahorro SET monto_ahorrado = monto_ahorrado + ($1 * $2) WHERE id = $3 RETURNING *',
      [monto, multiplicador, plan_id]
    );

    res.status(201).json({ message: 'Éxito', planActualizado: updateResult.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- TASAS ---
app.get('/api/tasas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasas_config ORDER BY plazo ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasas', async (req, res) => {
  try {
    const { plazo, tasa } = req.body;
    const result = await pool.query(
      'INSERT INTO tasas_config (plazo, tasa) VALUES ($1, $2) ON CONFLICT (plazo) DO UPDATE SET tasa = EXCLUDED.tasa RETURNING *',
      [plazo, tasa]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMINS ---
app.get('/api/admins', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM administradores');
    res.json(result.rows);
  } catch (err: any) {
    // Si la tabla no existe aún, devolvemos un array vacío temporalmente
    res.json([]);
  }
});

app.post('/api/admins', async (req, res) => {
  try {
    const { email } = req.body;
    await pool.query(
      'CREATE TABLE IF NOT EXISTS administradores (email text primary key)');
    const result = await pool.query(
      'INSERT INTO administradores (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING *',
      [email.toLowerCase()]
    );
    res.status(201).json({ message: 'Administrador agregado con éxito' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});