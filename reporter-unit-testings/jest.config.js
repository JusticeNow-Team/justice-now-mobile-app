/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  rootDir: "..",
  roots: ["<rootDir>/reporter-unit-testings"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/reporter-unit-testings/setup/jest.setup.ts"],
  moduleNameMapper: {
    // Every import of the real Supabase client is redirected to an in-memory
    // mock, so no test can ever reach or write to the live database.
    "^(.*)/lib/supabase$": "<rootDir>/reporter-unit-testings/mocks/supabaseClient.ts",
    "^lucide-react-native$": "<rootDir>/reporter-unit-testings/mocks/lucideIcons.tsx",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testTimeout: 20000,
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|lucide-react-native|react-native-svg)",
  ],
  clearMocks: true,
  collectCoverageFrom: [
    "<rootDir>/src/reporter/**/*.{ts,tsx}",
    "!<rootDir>/src/reporter/**/index.ts",
  ],
  coverageDirectory: "<rootDir>/reporter-unit-testings/coverage",
};
