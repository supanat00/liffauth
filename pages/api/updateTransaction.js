import pool from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { accessId, field } = req.body;

  if (!accessId || !field) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Validate field name to prevent SQL injection
    const allowedFields = ['takePhoto', 'takeVideo', 'saveAndShare'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid field' });
    }

    // Check if the accessId exists
    const [existingRecord] = await pool.query(
      'SELECT * FROM transactions WHERE accessId = ? LIMIT 1',
      [accessId]
    );

    if (existingRecord.length === 0) {
      return res.status(500).json({ error: 'Transaction not found' });
    }

    // Dynamic SQL to increment the correct field by 1
    const sql = `UPDATE transactions SET ${field} = ${field} + 1, updatedAt = NOW() WHERE accessId = ?`;
    await pool.query(sql, [accessId]);

    return res.status(200).json({ message: `${field} incremented successfully`, accessId });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
