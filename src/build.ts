import * as path from "node:path";
import * as fs from "node:fs";
import {loadFiltersListsConfig} from "./config";
import {getNextPackageVersion} from "./version";
import {loadUnifiedExternalRules} from "./unified";
import {buildDefinition, isProcessable, scanFilterFiles} from "./filterList";

const repoRoot = path.resolve(import.meta.dirname, "..");
const filtersListDir = path.resolve(repoRoot, "filterslists");
const outputDir = path.resolve(repoRoot, process.env.FILTERSLISTS_OUTPUT_DIR ?? "dist");

const nextVersion = process.env.FILTERSLISTS_NEXT_PACKAGE_VERSION?.trim() || await getNextPackageVersion();

const config = await loadFiltersListsConfig(path.join(filtersListDir, "filterslists.config.json"));

for (const entry of config) {
    const defPath = path.join(filtersListDir, entry.definitionFileName);
    if (!fs.existsSync(defPath)) throw new Error(`Definition file not found: ${defPath}`);
}

const filterFiles = scanFilterFiles(filtersListDir);
const processableCache = new Map<string, boolean>();
for (const f of filterFiles) processableCache.set(f, isProcessable(f));
console.log(`Preprocessed ${processableCache.size} filter files`);

const externalRules = await loadUnifiedExternalRules(config, filtersListDir);

for (const entry of config) {
    await buildDefinition(entry, filtersListDir, outputDir, processableCache, externalRules);
}

const pkgPath = path.resolve(repoRoot, "package.json");
const pkg = await Bun.file(pkgPath).json();
pkg.version = nextVersion;
await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log(`Build complete: ${nextVersion}`);
