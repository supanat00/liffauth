import pool from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, saveAndShare, artistId, takePhoto, takeVideo, accessId } = req.body;

  if (!userId || !artistId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await pool.query(
      `INSERT INTO transactions (userId, accessId, saveAndShare, artistId, takePhoto, takeVideo) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, accessId, saveAndShare, artistId, takePhoto, takeVideo]
    );

    return res.status(201).json({ message: 'New transaction created', accessId: accessId });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
