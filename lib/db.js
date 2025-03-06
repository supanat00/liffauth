import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.NEXT_PUBLIC_DB_HOST,      // AWS RDS endpoint
  user: process.env.NEXT_PUBLIC_DB_USER,      // RDS username
  password: process.env.NEXT_PUBLIC_DB_PASS,  // RDS password
  database: process.env.NEXT_PUBLIC_DB_NAME,  // Database name
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
