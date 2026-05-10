/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  /** Reduce picos de memoria en Windows (OOM/SIGTERM en workers paralelos). */
  maxWorkers: process.env.CI === 'true' ? '50%' : 2,
};
