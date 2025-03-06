import pool from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Get page and limit from query parameters, set defaults if not provided
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // Default 10 records per page
    const offset = (page - 1) * limit;

    // Get total number of records
    const [[{ totalRecords }]] = await pool.query(`SELECT COUNT(*) AS totalRecords FROM transactions`);

    // Fetch aggregated data per date
    const [rows] = await pool.query(`
      SELECT 
        DATE(createdAt) AS date, 
        COUNT(*) AS totalRows,  -- Total transactions per day
        COUNT(DISTINCT userId) AS uniqueUsers, -- Unique users per day
        SUM(saveAndShare) AS totalSaveAndShare -- Sum of save & share actions per day
      FROM transactions
      GROUP BY DATE(createdAt)
      ORDER BY DATE(createdAt) DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    // Sum all rows by artistId (1-13)
    const [rowsByArtist] = await pool.query(`
      SELECT 
        artistId, 
        COUNT(*) AS totalRows
      FROM transactions
      WHERE artistId BETWEEN 1 AND 13
      GROUP BY artistId
    `);

    // Sum all save and share by artistId (1-13)
    const [saveShareByArtist] = await pool.query(`
      SELECT 
        artistId, 
        SUM(saveAndShare) AS totalSaveAndShare
      FROM transactions
      WHERE artistId BETWEEN 1 AND 13
      GROUP BY artistId
    `);

    // Generate default artist data for IDs 1-13 with totalRows: 0
    const defaultArtists = Array.from({ length: 13 }, (_, i) => ({
      artistId: i + 1,
      totalRows: 0,
    }));
    const defaultSaveShareArtists = Array.from({ length: 13 }, (_, i) => ({
      artistId: i + 1,
      totalSaveAndShare: 0,
    }));

    // Merge database results with defaultArtists to ensure all artist IDs are included
    const sumByArtist = defaultArtists.map(defaultArtist => {
      const found = rowsByArtist.find(row => row.artistId === defaultArtist.artistId);
      return found ? found : defaultArtist;
    });
    const sumSaveShareByArtist = defaultSaveShareArtists.map(defaultArtist => {
      const found = saveShareByArtist.find(row => row.artistId === defaultArtist.artistId);
      return found ? found : defaultArtist;
    });

    return res.status(200).json({
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page,
      pageSize: limit,
      data: rows,
      sumByArtist: sumByArtist,
      saveShareByArtist: sumSaveShareByArtist
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
