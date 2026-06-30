import { Router, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import pool, { adminQuery } from '../db';
import { CustomRequest, authenticateToken } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_mvp_change_me';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, companyName } = req.body;

  if (!email || !password || !companyName) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email already registered
    const emailCheck = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // 1. Create Tenant
    const tenantRes = await client.query(
      'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
      [companyName]
    );
    const tenantId = tenantRes.rows[0].id;

    // 2. Create User
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userRes = await client.query(
      'INSERT INTO users (tenant_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [tenantId, email, passwordHash]
    );
    const userId = userRes.rows[0].id;

    await client.query('COMMIT');

    // 3. Issue JWT
    const token = jwt.sign(
      { userId, tenantId, email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      token,
      user: { id: userId, email, tenantId, companyName }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration failed:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Call the SECURITY DEFINER function to bypass RLS for email lookup
    const userLookup = await adminQuery(
      'SELECT * FROM get_user_by_email($1)',
      [email]
    );

    if (userLookup.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const dbUser = userLookup.rows[0];
    const isMatch = await bcrypt.compare(password, dbUser.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Retrieve company name
    const tenantRes = await adminQuery(
      'SELECT name FROM tenants WHERE id = $1',
      [dbUser.tenant_id]
    );
    const companyName = tenantRes.rows[0]?.name || 'My Company';

    // Issue JWT
    const token = jwt.sign(
      { userId: dbUser.id, tenantId: dbUser.tenant_id, email: dbUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        tenantId: dbUser.tenant_id,
        companyName
      }
    });
  } catch (err) {
    console.error('Login failed:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/auth/me (Helper to verify sessions)
router.get('/me', authenticateToken, async (req: CustomRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const tenantRes = await adminQuery('SELECT name FROM tenants WHERE id = $1', [req.user.tenantId]);
    return res.status(200).json({
      user: {
        id: req.user.userId,
        email: req.user.email,
        tenantId: req.user.tenantId,
        companyName: tenantRes.rows[0]?.name || 'My Company'
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/whatsapp (Update tenant's WhatsApp number for alert routing)
router.post('/whatsapp', authenticateToken, async (req: CustomRequest, res: Response) => {
  const { whatsappNumber } = req.body;
  const user = req.user!;

  try {
    await adminQuery(
      'UPDATE tenants SET whatsapp_number = $1 WHERE id = $2',
      [whatsappNumber, user.tenantId]
    );
    return res.status(200).json({ message: 'WhatsApp configuration updated successfully.' });
  } catch (err) {
    console.error('Failed to update WhatsApp number:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
