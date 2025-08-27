export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export const databaseConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'acmo_shop',
  user: process.env.DB_USER || 'acmo_user',
  password: process.env.DB_PASSWORD || 'acmo_password',
};
