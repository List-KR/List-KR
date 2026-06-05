import * as Piscina from 'piscina'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Process from 'node:process'
import * as Zod from 'zod'
import { SafeInitCwd } from './utils/cwd.ts'
import { LoadFiltersListsConfig } from './filterslists-config.ts'
import { LoadUnifiedExternalRules } from './unified-external-sources.ts'
import { BuildManifestFileName, CreateBuildManifestFromOutputDirectory, WriteBuildManifest } from './build-manifest.ts'
import { GetNextPackageVersion } from './package-version.ts'

const DefinitionVersionMapSchema = Zod.record(Zod.string(), Zod.string())

// Determine working directory
const WorkingDirectory = SafeInitCwd({ Cwd: Process.cwd(), InitCwd: Process.env.INIT_CWD })
const FiltersListDirectory = Path.resolve(WorkingDirectory, 'filterslists')
const OutputDirectory = Path.resolve(WorkingDirectory, Process.env.FILTERSLISTS_OUTPUT_DIR ?? 'dist')
const BuildManifestFilePath = Path.resolve(
  WorkingDirectory,
  Process.env.FILTERSLISTS_BUILD_MANIFEST_FILE ?? Path.join(OutputDirectory, BuildManifestFileName)
)
const NextPackageVersion = Process.env.FILTERSLISTS_NEXT_PACKAGE_VERSION ?? await GetNextPackageVersion()
const DefinitionVersionMap = LoadDefinitionVersionMap(Process.env.FILTERSLISTS_DEFINITION_VERSIONS_JSON)

// Validate existence of filters lists directory and config file
const FiltersListDefinitionFiles = Fs.globSync(Path.resolve(FiltersListDirectory, '*.txt'))
const FiltersListsConfigFile = Path.resolve(FiltersListDirectory, 'filterslists.config.json')
if (!Fs.existsSync(FiltersListsConfigFile)) {
  throw new Error(`Filters lists config file not found: ${FiltersListsConfigFile}`)
}
// Load filters lists config with versioning
const FiltersListsConfigWithVersion = await LoadFiltersListsConfig(FiltersListsConfigFile, {
  DefaultVersion: NextPackageVersion,
  DefinitionVersionMap
})
if (!FiltersListsConfigWithVersion.every(Def => Def.DefinitionFileName && FiltersListDefinitionFiles.includes(Path.resolve(FiltersListDirectory, Def.DefinitionFileName)))) {
  throw new Error('No filters list defined in the config file.')  
}

// Preprocess: Determine processable filters files
const FiltersPathes = Fs.globSync(Path.resolve(FiltersListDirectory, '*/**/*.txt'))
const FiltersProcessableCache: Map<string, boolean> = new Map()
const FiltersProcessableWorkerpool = new Piscina.Piscina({
  filename: Path.resolve(WorkingDirectory, 'builder/source/worker-filter-processable.ts'),
  execArgv: ['--import=tsx']
})
const FiltersProcessableResults: Promise<{ FileName: string, Result: boolean }>[] = []
for (const FiltersPath of FiltersPathes) {
  FiltersProcessableResults.push(FiltersProcessableWorkerpool.run(FiltersPath))
}
(await Promise.all(FiltersProcessableResults)).forEach(Result => FiltersProcessableCache.set(Result.FileName, Result.Result))
console.log(`Preprocessed ${FiltersProcessableCache.size} filters files for processability.`)

const UnifiedExternalRules = await LoadUnifiedExternalRules(FiltersListsConfigWithVersion, FiltersListDirectory)

// Build: Process each filters list definition
const FiltersBuildResolvedWorkerpool = new Piscina.Piscina({
  filename: Path.resolve(WorkingDirectory, 'builder/source/worker-bundle-resolved.ts'),
  execArgv: [...Process.execArgv, '--import=tsx'],
  workerData: { FiltersProcessableCache, WorkingDirectory, FiltersListDirectory, OutputDirectory, UnifiedExternalRules }
})
const FiltersBuildWorkerpool = new Piscina.Piscina({
  filename: Path.resolve(WorkingDirectory, 'builder/source/worker-bundle-with-ifs.ts'),
  execArgv: [...Process.execArgv, '--import=tsx'],
  workerData: { FiltersProcessableCache, WorkingDirectory, FiltersListDirectory, OutputDirectory, UnifiedExternalRules }
})
const FiltersBuildResults: Promise<void>[] = []
for (const FiltersListDefinition of FiltersListsConfigWithVersion) {
  FiltersBuildResults.push(FiltersBuildResolvedWorkerpool.run(FiltersListDefinition))
  FiltersBuildResults.push(FiltersBuildWorkerpool.run(FiltersListDefinition))
}
await Promise.all(FiltersBuildResults)

WriteBuildManifest(
  BuildManifestFilePath,
  CreateBuildManifestFromOutputDirectory(OutputDirectory, NextPackageVersion, FiltersListsConfigWithVersion)
)

function LoadDefinitionVersionMap(RawDefinitionVersionMap?: string): Record<string, string> | undefined {
  if (!RawDefinitionVersionMap) {
    return undefined
  }

  return DefinitionVersionMapSchema.parse(JSON.parse(RawDefinitionVersionMap))
}
