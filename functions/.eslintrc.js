module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    "max-len": ["error", { "code": 100 }],
    "require-jsdoc": 0,
    "linebreak-style": 0, // Allow both CRLF and LF
    "object-curly-spacing": ["error", "always"], // Consistent spacing in objects
    "@typescript-eslint/no-explicit-any": "warn", // Warn instead of error for any
    "comma-dangle": ["error", "always-multiline"], // Require trailing commas
    "no-trailing-spaces": "error", // No trailing spaces
    "padded-blocks": ["error", "never"], // No padding in blocks
    "eol-last": ["error", "always"], // Require newline at end of files
  },
};
