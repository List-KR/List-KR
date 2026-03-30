import * as AGTree from '@adguard/agtree'
import * as Piscina from 'piscina'
import * as Path from 'node:path'
import * as Fs from 'node:fs'
import type { FiltersListsConfigWithVersion } from './filterslists-config.ts'
import { BuildBundledFiltersLists } from './worker-bundle-core.ts'

type WorkerData = {
  FiltersProcessableCache: Map<string, boolean>
  WorkingDirectory: string
  FiltersListDirectory: string
}

class BuildBundledResolvedFiltersLists extends BuildBundledFiltersLists {
  Build(FiltersList: AGTree.FilterList, FiltersListDefinition: FiltersListsConfigWithVersion[number]): void {
    for (const [FileName, ResolvedFiltersList] of this.ExtractAsMap(FiltersList, FiltersListDefinition)) {
      this.FiltersListOutputFS.fs.writeFileSync(
        Path.posix.join('/', FileName),
        this.StringifyFilterList(ResolvedFiltersList),
        { encoding: 'utf-8' }
      )
    }
  }

  Extract(OutputDirectoryName: string): void {
    const OutputDirectoryPath = Path.resolve(this.WorkingDirectory, 'dist', 'resolved', OutputDirectoryName)
    Fs.mkdirSync(OutputDirectoryPath, { recursive: true })

    for (const FilePath of this.FiltersListOutputFS.fs.readdirSync('/')) {
      const FileName = FilePath.toString()
      const FileRaw = this.FiltersListOutputFS.fs.readFileSync(Path.posix.join('/', FileName), 'utf-8')
      Fs.writeFileSync(Path.resolve(OutputDirectoryPath, FileName), FileRaw, 'utf-8')
    }
  }
}

export default function WorkerBundleResolved(FiltersListDefinition: FiltersListsConfigWithVersion[number]): void {
  const WorkerData = Piscina.workerData as WorkerData
  const FiltersListDefPath = Path.resolve(WorkerData.FiltersListDirectory, FiltersListDefinition.DefinitionFileName)
  const FiltersListDef = AGTree.FilterListParser.parse(Fs.readFileSync(FiltersListDefPath, 'utf-8'), { parseUboSpecificRules: true })
  const Builder = new BuildBundledResolvedFiltersLists(WorkerData)

  Builder.Build(FiltersListDef, FiltersListDefinition)
  Builder.Extract(Path.basename(FiltersListDefinition.DefinitionFileName, Path.extname(FiltersListDefinition.DefinitionFileName)))
}
