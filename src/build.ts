import path from "node:path";
import {existsSync} from "node:fs";
import {readFile, writeFile} from "node:fs/promises";
import {loadFiltersListsConfig} from "./config";
import {getNextPackageVersion} from "./version";
import {buildDefinition, isProcessable, scanFilterFiles} from "./filterList";

const repoRoot = path.resolve(import.meta.dirname, "..");
const filtersListDir = path.resolve(repoRoot, "filterslists");
const outputDir = path.resolve(repoRoot, "dist");

const nextVersion = getNextPackageVersion();
const config = await loadFiltersListsConfig(path.join(filtersListDir, "filterslists.config.json"));

for (const entry of config) {
    const defPath = path.join(filtersListDir, entry.definitionFileName);
    if (!existsSync(defPath)) throw new Error(`Definition file not found: ${defPath}`);
}

const filterFiles = scanFilterFiles(filtersListDir);
const processableCache = new Map<string, boolean>();
const processableFlags = await Promise.all(filterFiles.map(isProcessable));
for (let i = 0; i < filterFiles.length; i++) processableCache.set(filterFiles[i]!, processableFlags[i]!);
console.log(`Preprocessed ${processableCache.size} filter files`);

await Promise.all(config.map(entry => buildDefinition(entry, filtersListDir, outputDir, processableCache)));

const pkgPath = path.resolve(repoRoot, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as {version: string};
pkg.version = nextVersion;
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log(`Build complete: ${nextVersion}`);
