const { spawnSync } = require("child_process");
const path = require("path");

const prismaPath = path.join(
  __dirname,
  "../node_modules/prisma/build/index.js"
);

const result = spawnSync("node", [prismaPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status);
