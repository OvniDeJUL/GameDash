const { spawnSync } = require("node:child_process");
const { delimiter, join } = require("node:path");

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/run-turbo.cjs <task> [extra turbo args]");
  process.exit(1);
}

const env = {
  ...process.env,
  PATH: `${join(__dirname, "shims")}${delimiter}${process.env.PATH ?? ""}`
};

const turboBin = require.resolve("turbo/bin/turbo");
const result = spawnSync(process.execPath, [turboBin, "run", ...args], {
  cwd: process.cwd(),
  env,
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
