module.exports = {
  rootDir: '..',
  testMatch: [
    '<rootDir>/src/util/peopleCategory.test.ts',
    '<rootDir>/src/lib/gramjs/client/MockClient.test.ts',
    '<rootDir>/dev/noImmediateGlobal.test.js',
  ],
  testEnvironment: 'jsdom',
  transform: { '\\.(jsx?|tsx?)$': 'babel-jest' },
  globals: { APP_REVISION: 'people-test', APP_VERSION: '0.0.1' },
};
