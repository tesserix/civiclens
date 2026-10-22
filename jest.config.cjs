module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  modulePathIgnorePatterns: ['<rootDir>/target/', '<rootDir>/dist/'],
};
