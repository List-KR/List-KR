import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Process from 'node:process'
import * as WorkerThread from 'node:worker_threads'
import * as Memfs from 'memfs'
import * as AGTree from '@adguard/agtree'
import * as ActionCore from '@actions/core'
import type { FiltersListsConfigWithVersion } from './filterslists-config.ts'

type WorkerData = {
  FiltersProcessableCache: Map<string, boolean>
  WorkingDirectory: string
  FiltersListDirectory: string
}

type PlatformConfig = {
  FileName: string
  Vars: Record<string, boolean>
}

export class BuildBundledFiltersLists {
  protected FiltersProcessableCache: Map<string, boolean>
  protected WorkingDirectory: string
  protected FiltersListDirectory: string
  protected FiltersListOutputFS: ReturnType<typeof Memfs.memfs>
  protected PlatformKey2FilenameMap: Map<string, string>
  protected PlatformConfigMap: Map<string, PlatformConfig>

  constructor(WorkerData: WorkerData) {
    this.FiltersListDirectory = WorkerData.FiltersListDirectory
    this.WorkingDirectory = WorkerData.WorkingDirectory
    this.FiltersProcessableCache = WorkerData.FiltersProcessableCache
    this.FiltersListOutputFS = Memfs.memfs()

    const PlatformConfigs: [string, PlatformConfig][] = [
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.AdgCbAndroid), { FileName: 'adguard-content-blocker.txt', Vars: { adguard: true, adguard_ext_android_cb: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.AdgCbIos), { FileName: 'adguard-ios.txt', Vars: { adguard: true, adguard_app_ios: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.AdgCbSafari), { FileName: 'adguard-safari.txt', Vars: { adguard: true, adguard_ext_safari: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.AdgExtChrome), { FileName: 'adguard-chromium.txt', Vars: { adguard: true, adguard_ext_chromium: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.AdgExtEdge), { FileName: 'adguard-edge.txt', Vars: { adguard: true, adguard_ext_edge: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.AdgExtFirefox), { FileName: 'adguard-firefox.txt', Vars: { adguard: true, adguard_ext_firefox: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.AdgExtOpera), { FileName: 'adguard-opera.txt', Vars: { adguard: true, adguard_ext_chromium: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.AdgOsAndroid), { FileName: 'adguard-android.txt', Vars: { adguard: true, adguard_app_android: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.AdgOsMac), { FileName: 'adguard-mac.txt', Vars: { adguard: true, adguard_app_mac: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.AdgOsWindows), { FileName: 'adguard-windows.txt', Vars: { adguard: true, adguard_app_windows: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.UboExtChrome), { FileName: 'ubo-chromium.txt', Vars: { ext_ublock: true, cap_user_stylesheet: true, cap_html_filtering: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.UboExtEdge), { FileName: 'ubo-edge.txt', Vars: { ext_ublock: true, cap_user_stylesheet: true, cap_html_filtering: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.UboExtFirefox), { FileName: 'ubo-firefox.txt', Vars: { ext_ublock: true, cap_user_stylesheet: true, cap_html_filtering: true } }],
      [AGTree.stringifyPlatforms(AGTree.SpecificPlatform.UboExtOpera), { FileName: 'ubo-opera.txt', Vars: { ext_ublock: true, cap_user_stylesheet: true, cap_html_filtering: true } }]
    ]

    this.PlatformKey2FilenameMap = new Map(PlatformConfigs.map(([PlatformKey, Config]) => [PlatformKey, Config.FileName]))
    this.PlatformConfigMap = new Map(PlatformConfigs)
  }

  protected IsPreProcessorCommentRule(Filter: AGTree.AnyRule): Filter is AGTree.PreProcessorCommentRule {
    const IsPreProcessor = Filter.type === 'PreProcessorCommentRule'

    if (IsPreProcessor) {
      const PreProcessorFilter = Filter as AGTree.PreProcessorCommentRule
      ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] Encountered preprocessor directive #${PreProcessorFilter.name.value}`)
    }

    return IsPreProcessor
  }

  protected ParseFilterList(FilePath: string): AGTree.FilterList {
    return AGTree.FilterListParser.parse(Fs.readFileSync(FilePath, 'utf-8'), { parseUboSpecificRules: true })
  }

  protected StringifyFilterList(FiltersList: AGTree.FilterList): string {
    let Output = ''

    for (let Index = 0; Index < FiltersList.children.length; Index += 1) {
      const Filter = FiltersList.children[Index]
      Output += Filter.raws?.text ?? AGTree.RuleGenerator.generate(Filter)

      switch (Filter.raws?.nl) {
        case 'crlf':
          Output += '\r\n'
          break
        case 'cr':
          Output += '\r'
          break
        case 'lf':
          Output += '\n'
          break
        default:
          if (Index !== FiltersList.children.length - 1) {
            Output += '\n'
          }
          break
      }
    }

    return Output
  }

  protected EvalIf(Filter: AGTree.PreProcessorCommentRule, Vars: Record<string, boolean>): boolean {
    const Expression = Filter.params
    if (!Expression) {
      ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] EvalIf: empty expression, resolved as false`)
      return false
    }

    if (Expression.type === 'Value') {
      const Result = !!Vars[Expression.value]
      ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] EvalIf: variable "${Expression.value}" resolved as ${Result}`)
      return Result
    }

    const Result = AGTree.LogicalExpressionUtils.evaluate(Expression as AGTree.AnyExpressionNode, Vars)
    ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] EvalIf: expression node "${Expression.type}" resolved as ${Result}`)

    return Result
  }

  protected BundleIncludes(FiltersList: AGTree.FilterList): AGTree.FilterList {
    ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] BundleIncludes: start (${FiltersList.children.length} rules)`)
    const FiltersChildren: AGTree.AnyRule[] = []

    for (const Filter of FiltersList.children) {
      if (!this.IsPreProcessorCommentRule(Filter) || Filter.name.value !== 'include' || !Filter.params || Filter.params.type !== 'Value') {
        FiltersChildren.push(Filter)
        continue
      }

      const IncludedFilePath = Path.resolve(this.FiltersListDirectory, Filter.params.value)
      ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] BundleIncludes: include candidate ${IncludedFilePath}`)

      if (!this.FiltersProcessableCache.get(IncludedFilePath)) {
        ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] BundleIncludes: skipped include ${IncludedFilePath} (not processable)`)
        continue
      }

      const IncludedFiltersList = this.BundleIncludes(this.ParseFilterList(IncludedFilePath))
      ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] BundleIncludes: expanded include ${IncludedFilePath} with ${IncludedFiltersList.children.length} rules`)
      FiltersChildren.push(...IncludedFiltersList.children)
    }

    ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] BundleIncludes: completed (${FiltersChildren.length} rules)`)

    return {
      ...FiltersList,
      children: FiltersChildren
    }
  }

  protected ResolveForPlatform(FiltersList: AGTree.FilterList, Vars: Record<string, boolean>): AGTree.FilterList {
    const FiltersChildren: AGTree.AnyRule[] = []
    const IfStack: boolean[] = []

    for (const Filter of FiltersList.children) {
      if (this.IsPreProcessorCommentRule(Filter)) {
        if (Filter.name.value === 'if') {
          const IfResult = this.EvalIf(Filter, Vars)
          IfStack.push(IfResult)
          ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] ResolveForPlatform: push #if => ${IfResult}, depth=${IfStack.length}`)
          continue
        }

        if (Filter.name.value === 'endif') {
          IfStack.pop()
          ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] ResolveForPlatform: pop #endif, depth=${IfStack.length}`)
          continue
        }
      }

      if (IfStack.every(Boolean)) {
        FiltersChildren.push(Filter)
      }
    }

    return {
      ...FiltersList,
      children: FiltersChildren
    }
  }

  protected BuildHeaderFilterList(Definition: FiltersListsConfigWithVersion[number]): AGTree.FilterList {
    const ExpiresLabel = Definition.ExpireDuration === 1 ? 'day' : 'days'
    const HeaderLines = [
      `! Title: ${Definition.Name}`,
      `! Description: ${Definition.Description}`,
      `! Version: ${Definition.Version}`,
      `! Expires: ${Definition.ExpireDuration} ${ExpiresLabel} (update frequency)`,
      `! Homepage: ${Definition.HomepageUrl}`,
      `! Licence: ${Definition.LicenseUrl}`,
      ''
    ].join('\n')
    return AGTree.FilterListParser.parse(HeaderLines, { parseUboSpecificRules: true })
  }

  ExtractAsMap(FiltersList: AGTree.FilterList, Definition: FiltersListsConfigWithVersion[number]): Map<string, AGTree.FilterList> {
    ActionCore.info(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] Start extracting resolved lists for ${Definition.DefinitionFileName}`)
    const BundledFiltersList = this.BundleIncludes(FiltersList)
    const HeaderFilterList = this.BuildHeaderFilterList(Definition)
    const OutputFiltersLists = new Map<string, AGTree.FilterList>()

    for (const [PlatformKey, FileName] of this.PlatformKey2FilenameMap) {
      const PlatformConfig = this.PlatformConfigMap.get(PlatformKey)
      if (!PlatformConfig) {
        continue
      }

      const ResolvedFiltersList = this.ResolveForPlatform(BundledFiltersList, PlatformConfig.Vars)
      ActionCore.debug(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] Resolved ${FileName} (${PlatformKey}) with ${ResolvedFiltersList.children.length} rules`)
      OutputFiltersLists.set(FileName, {
        ...ResolvedFiltersList,
        children: [...HeaderFilterList.children, ...ResolvedFiltersList.children]
      })
    }

    ActionCore.info(`[bundle-core pid=${Process.pid} threadid=${WorkerThread.threadId}] Completed extracting ${OutputFiltersLists.size} resolved lists for ${Definition.DefinitionFileName}`)

    return OutputFiltersLists
  }
}
