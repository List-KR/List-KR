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

class BuildBundledFiltersListsWithIfs extends BuildBundledFiltersLists {
  Build(FiltersListDefinition: FiltersListsConfigWithVersion[number], FiltersList: AGTree.FilterList): void {
    ActionCore.info(`[bundle-with-ifs pid=${Process.pid} threadid=${WorkerThread.threadId}] Building bundled list for ${FiltersListDefinition.DefinitionFileName}`)

    const BundledFiltersList = this.BundleIncludes(FiltersList)
    const HeaderFilterList = this.BuildHeaderFilterList(FiltersListDefinition)
    const OutputFileName = FiltersListDefinition.DefinitionFileName
    const OutputFilePath = Path.resolve(this.WorkingDirectory, 'dist', OutputFileName)

    Fs.mkdirSync(Path.resolve(this.WorkingDirectory, 'dist'), { recursive: true })
    Fs.writeFileSync(
      OutputFilePath,
      this.StringifyFilterList({
        ...BundledFiltersList,
        children: [...HeaderFilterList.children, ...BundledFiltersList.children]
      }),
      'utf-8'
    )

    ActionCore.info(`[bundle-with-ifs pid=${Process.pid} threadid=${WorkerThread.threadId}] Wrote bundled list to ${OutputFilePath}`)
  }
}

export default function WorkerBundleWithIfs(FiltersListDefinition: FiltersListsConfigWithVersion[number]): void {
  const WorkerData = Piscina.workerData as WorkerData
  const FiltersListDefPath = Path.resolve(WorkerData.FiltersListDirectory, FiltersListDefinition.DefinitionFileName)
  const FiltersListDef = AGTree.FilterListParser.parse(Fs.readFileSync(FiltersListDefPath, 'utf-8'), { parseUboSpecificRules: true })

  new BuildBundledFiltersListsWithIfs(WorkerData).Build(FiltersListDefinition, FiltersListDef)
}
