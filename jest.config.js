const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  setupFilesAfterEnv: ['jest-extended/all'],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  roots: ["<rootDir>/src"],
  testMatch: ["**/tests/**/*.test.ts"],

};