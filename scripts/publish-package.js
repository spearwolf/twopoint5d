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

function shouldPublish() {
  if (pkgJson.version.endsWith("-dev")) {
    console.log('*** aborting - package version ends with "-dev" !');
    return false;
  }

  try {
    shell.echo("npm show versions:");

    const versions = JSON.parse(
      shell
        .exec(`npm show ${pkgJson.name} versions --json`, { silent: false })
        .toString()
    );

    if (
      (typeof versions === "string" && versions === pkgJson.version) ||
      (Array.isArray(versions) && versions.includes(pkgJson.version))
    ) {
      console.log(
        "*** aborting - the package version has already been released !"
      );
      return false;
    }
  } catch (err) {
    console.error("*** error while checking package version:", err);
  }

  return true;
}

const pkgDisplayName = `${pkgJson.name}@${pkgJson.version}`;

console.log("======= PUBLISH", pkgDisplayName, "=====");

if (shouldPublish()) {
  shell.cd(packageDir);

  console.log("\n--- Step 1) Build", pkgDisplayName);

  if (shell.exec(`yarn build`).code !== 0) {
    shell.echo("Error: yarn build failed");
    shell.exit(2);
  }

  console.log("\n--- Step 2) Publish package", pkgDisplayName);

  if (shell.exec(`echo yarn npm publish --tolerate-republish`).code !== 0) {
    shell.echo("Error: yarn npm publish failed");
    shell.exit(3);
  }

  console.log("\nSuccess!! Thank you and have a nice day ;)\nReady.");
}
