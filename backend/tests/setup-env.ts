import path from 'path';
import dotenv from 'dotenv';

// API tests always run against the separate serendibgo_test database.
dotenv.config({ path: path.join(__dirname, '..', '.env.test'), override: true, quiet: true });
process.env.NODE_ENV = 'test';
