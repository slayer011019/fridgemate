export const serverConfig = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || ''
};

export function assertServerEnv() {
  if (!serverConfig.databaseUrl) {
    throw new Error('DATABASE_URL is required before starting the API server.');
  }
}
