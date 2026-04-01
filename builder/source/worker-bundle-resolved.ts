import * as AGTree from '@adguard/agtree'
import * as ActionCore from '@actions/core'
import * as Piscina from 'piscina'
import * as Path from 'node:path'
import * as Fs from 'node:fs'
import * as Process from 'node:process'
import * as WorkerThread from 'node:worker_threads'
import type { FiltersListsConfigWithVersion } from './filterslists-config.ts'
import { BuildBundledFiltersLists } from './worker-bundle-core.ts'

type WorkerData = {
  FiltersProcessableCache: Map<string, boolean>
  WorkingDirectory: string
  FiltersListDirectory: string
}

class BuildBundledResolvedFiltersLists extends BuildBundledFiltersLists {
  Build(FiltersList: AGTree.FilterList, FiltersListDefinition: FiltersListsConfigWithVersion[number]): void {
    ActionCore.info(`[bundle-resolved pid=${Process.pid} threadid=${WorkerThread.threadId}] Building resolved variants for ${FiltersListDefinition.DefinitionFileName}`)

    for (const [FileName, ResolvedFiltersList] of this.ExtractAsMap(FiltersList, FiltersListDefinition)) {
      ActionCore.debug(`[bundle-resolved pid=${Process.pid} threadid=${WorkerThread.threadId}] Writing in-memory file ${FileName}`)
      this.FiltersListOutputFS.fs.writeFileSync(
        Path.posix.join('/', FileName),
        this.StringifyFilterList(ResolvedFiltersList),
        { encoding: 'utf-8' }
      )
    }

    ActionCore.info(`[bundle-resolved pid=${Process.pid} threadid=${WorkerThread.threadId}] Finished building resolved variants for ${FiltersListDefinition.DefinitionFileName}`)
  }

  Extract(OutputDirectoryName: string): void {
    const OutputDirectoryPath = Path.resolve(this.WorkingDirectory, 'dist', 'resolved', OutputDirectoryName)
    ActionCore.info(`[bundle-resolved pid=${Process.pid} threadid=${WorkerThread.threadId}] Extracting resolved outputs to ${OutputDirectoryPath}`)
    Fs.mkdirSync(OutputDirectoryPath, { recursive: true })

    for (const FilePath of this.FiltersListOutputFS.fs.readdirSync('/')) {
      const FileName = FilePath.toString()
      const FileRaw = this.FiltersListOutputFS.fs.readFileSync(Path.posix.join('/', FileName), 'utf-8')
      Fs.writeFileSync(Path.resolve(OutputDirectoryPath, FileName), FileRaw, 'utf-8')
      ActionCore.debug(`[bundle-resolved pid=${Process.pid} threadid=${WorkerThread.threadId}] Extracted ${FileName}`)
    }

    ActionCore.info(`[bundle-resolved pid=${Process.pid} threadid=${WorkerThread.threadId}] Extraction completed for ${OutputDirectoryName}`)
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
