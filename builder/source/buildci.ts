import * as Piscina from 'piscina'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Process from 'node:process'
import { GetWorkingDirectory } from './utils/cwd.ts'
import { LoadFiltersListsConfig } from './filterslists-config.ts'

// Determine working directory
const WorkingDirectory = GetWorkingDirectory()
const FiltersListDirectory = Path.resolve(WorkingDirectory, 'filterslists')

// Validate existence of filters lists directory and config file
const FiltersListDefinitionFiles = Fs.globSync(Path.resolve(FiltersListDirectory, '*.txt'))
const FiltersListsConfigFile = Path.resolve(FiltersListDirectory, 'filterslists.config.json')
if (!Fs.existsSync(FiltersListsConfigFile)) {
  throw new Error(`Filters lists config file not found: ${FiltersListsConfigFile}`)
}
// Load filters lists config with versioning
const FiltersListsConfigWithVersion = await LoadFiltersListsConfig(FiltersListsConfigFile)
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

// Build: Process each filters list definition
const FiltersBuildResolvedWorkerpool = new Piscina.Piscina({
  filename: Path.resolve(WorkingDirectory, 'builder/source/worker-bundle-resolved.ts'),
  execArgv: [...Process.execArgv, '--import=tsx'],
  workerData: { FiltersProcessableCache, WorkingDirectory, FiltersListDirectory }
})
const FiltersBuildWorkerpool = new Piscina.Piscina({
  filename: Path.resolve(WorkingDirectory, 'builder/source/worker-bundle-with-ifs.ts'),
  execArgv: [...Process.execArgv, '--import=tsx'],
  workerData: { FiltersProcessableCache, WorkingDirectory, FiltersListDirectory }
})
const FiltersBuildResults: Promise<void>[] = []
for (const FiltersListDefinition of FiltersListsConfigWithVersion) {
  FiltersBuildResults.push(FiltersBuildResolvedWorkerpool.run(FiltersListDefinition))
  FiltersBuildResults.push(FiltersBuildWorkerpool.run(FiltersListDefinition))
}
await Promise.all(FiltersBuildResults)