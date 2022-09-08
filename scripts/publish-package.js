#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const shell = require("shelljs");

const projectDir = path.join(__dirname, "..");
const packageDir = path.join(projectDir, "packages", process.argv[2]);

if (!fs.existsSync(packageDir)) {
  console.warn(`Error: package directory "${packageDir}" does not exist`);
  shell.exit(1);
}

const pkgJson = JSON.parse(
  fs.readFileSync(path.join(packageDir, "package.json"), "utf8")
);

console.log("------- PUBLISH", pkgJson.name, pkgJson.version);

if (pkgJson.version.endsWith("-dev")) {
  console.log('aborting - package version ends with "-dev" !');
} else {
  shell.cd(packageDir);

  console.log("------- Step 1) Build", pkgJson.name, pkgJson.version);

  if (shell.exec(`yarn build`).code !== 0) {
    shell.echo("Error: yarn build failed");
    shell.exit(2);
  }

  console.log("------- Step 2) Publish package", pkgJson.name, pkgJson.version);

  if (shell.exec(`yarn npm publish  --tolerate-republish`).code !== 0) {
    shell.echo("Error: yarn npm publish failed");
    shell.exit(3);
  }
}
