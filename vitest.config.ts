import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration tests share one `bytemarket_test` database, so files must
    // not truncate each other's fixtures while running in parallel.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // Entrypoints, one-shot CLI scripts and type-only declarations are not
      // reachable from the test suites, so counting them distorts the report.
      exclude: [
        'src/main.ts',
        'src/infrastructure/persistence/run-migrations.ts',
        'src/infrastructure/persistence/seed.ts',
        'src/**/*.d.ts',
      ],
    },
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      TEST_DATABASE_URL: 'postgresql://bytemarket:bytemarket_dev_password@localhost:5432/bytemarket_test',
      CORS_ORIGIN: 'http://localhost:4200',
      JWT_SECRET: 'test_secret_that_is_long_enough',
    },
  },
});
