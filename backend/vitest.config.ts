import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/tests/globalSetup.ts'],
    // Tests never read backend/.env. The DB suite runs only when TEST_DATABASE_URL is set
    // in the environment, and then only against that database.
    env: {
      NODE_ENV: 'test',
      AUTH_RATE_LIMIT_MAX: '1000',
      APP_ORIGIN: 'http://localhost:3000',
      // V-02: lowest bcrypt cost in tests only (config honours these only when NODE_ENV=test).
      PASSWORD_BCRYPT_ROUNDS: '4',
      RECOVERY_CODE_BCRYPT_ROUNDS: '4',
    },
    fileParallelism: false,
  },
});
