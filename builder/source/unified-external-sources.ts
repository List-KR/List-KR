import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as AGTree from '@adguard/agtree'
import * as ActionCore from '@actions/core'
import { SimpleSecureReq } from '@typescriptprime/securereq'
import type { FiltersListsConfigWithVersion } from './filterslists-config.ts'

export type AdblockType = FiltersListsConfigWithVersion[number]['AdblockType']
export type UnifiedExternalRulesByAdblockType = Partial<Record<AdblockType, AGTree.AnyRule[]>>

export type UnifiedExternalSource = {
  Name: string
  Url: string
}

type ParsedExternalSource = {
  FilterList: AGTree.FilterList
  ParseErrorCount: number
}

type FilterExternalRulesResult = {
  Rules: AGTree.AnyRule[]
  KeptRules: number
  DroppedRules: number
  InvalidRules: number
}

type PreProcessorFrame = {
  IfIndex: number
  ElseIndex?: number
  HasKeptRule: boolean
  HasKeptElseRule: boolean
  IsElseBranch: boolean
}

type UnifiedDefinition = FiltersListsConfigWithVersion[number] & {
  UnifiedDomainListFileName: string
}

type StringResponse = Awaited<ReturnType<typeof SimpleSecureReq.Request>> & {
  Body: string
}

const AdGuardPagesRoot = 'https://adguardteam.github.io/AdguardFilters/'
const UAssetsFiltersRoot = 'https://ublockorigin.github.io/uAssets/filters/'

const AdGuardBaseSections = [
  'general_elemhide.txt',
  'allowlist_stealth.txt',
  'foreign.txt',
  'adservers.txt',
  'general_extensions.txt',
  'content_blocker.txt',
  'general_url.txt',
  'allowlist.txt',
  'replace.txt',
  'cryptominers.txt',
  'specific.txt',
  'adservers_firstparty.txt',
  'antiadblock.txt',
  'banner_sizes.txt'
]

const AdGuardTrackingProtectionSections = [
  'general_elemhide.txt',
  'cookies_general.txt',
  'tracking_servers.txt',
  'cookies_allowlist.txt',
  'general_extensions.txt',
  'general_url.txt',
  'allowlist.txt',
  'tracking_servers_firstparty.txt',
  'mobile.txt',
  'mobile_allowlist.txt',
  'specific.txt',
  'cookies_specific.txt'
]

const AdGuardUrlTrackingSections = [
  'general_url.txt',
  'allowlist.txt',
  'specific.txt'
]

const UAssetsAdsFilterFiles = [
  'filters.txt',
  'filters-general.txt',
  'filters-2020.txt',
  'filters-2021.txt',
  'filters-2022.txt',
  'filters-2023.txt',
  'filters-2024.txt',
  'filters-2025.txt',
  'filters-2026.txt',
  'quick-fixes.txt'
]

const NetworkHostTerminatingChars = new Set(['^', '/', '$', ':', '?', '#', '[', ']', '\\'])

const ParserOptions: AGTree.ParserOptions = {
  ...AGTree.defaultParserOptions,
  tolerant: true,
  parseAbpSpecificRules: true,
  parseUboSpecificRules: true,
  includeRaws: true
}

function BuildAdGuardSectionSources(FilterDirectoryName: string, SourceLabel: string, SectionFileNames: string[]): UnifiedExternalSource[] {
  return SectionFileNames.map(SectionFileName => ({
    Name: SourceLabel + '/' + SectionFileName,
    Url: new URL(FilterDirectoryName + '/sections/' + SectionFileName, AdGuardPagesRoot).toString()
  }))
}

function BuildUAssetsFilterSources(FilterFileNames: string[]): UnifiedExternalSource[] {
  return FilterFileNames.map(FilterFileName => ({
    Name: 'uAssets/' + FilterFileName,
    Url: new URL(FilterFileName, UAssetsFiltersRoot).toString()
  }))
}

export function GetUnifiedExternalSourceUrls(AdblockTypeValue: AdblockType): UnifiedExternalSource[] {
  const AdGuardTrackingSources = [
    ...BuildAdGuardSectionSources('SpywareFilter', 'AdGuard Tracking Protection', AdGuardTrackingProtectionSections),
    ...BuildAdGuardSectionSources('TrackParamFilter', 'AdGuard URL Tracking', AdGuardUrlTrackingSections)
  ]

  if (AdblockTypeValue === 'uBlockOrigin') {
    return [
      ...BuildUAssetsFilterSources(UAssetsAdsFilterFiles),
      ...AdGuardTrackingSources
    ]
  }

  return [
    ...BuildAdGuardSectionSources('BaseFilter', 'AdGuard Base', AdGuardBaseSections),
    ...AdGuardTrackingSources
  ]
}

export function ParseUnifiedDomains(RawDomainList: string): Set<string> {
  const Domains = new Set<string>()

  for (const RawLine of RawDomainList.split(/\r?\n/u)) {
    const TrimmedLine = RawLine.trim().toLowerCase()

    if (!TrimmedLine || TrimmedLine.startsWith('!') || TrimmedLine.startsWith('#')) {
      continue
    }

    const Domain = NormalizeCandidateDomain(TrimmedLine)
    if (Domain) {
      Domains.add(Domain)
    }
  }

  return Domains
}

export function DoesCandidateMatchUnifiedDomains(RawCandidate: string, UnifiedDomains: Set<string>): boolean {
  const Candidate = NormalizeCandidateDomain(RawCandidate)
  if (!Candidate) {
    return false
  }

  let CurrentCandidate = Candidate
  while (CurrentCandidate.length > 0) {
    if (UnifiedDomains.has(CurrentCandidate)) {
      return true
    }

    const NextDotIndex = CurrentCandidate.indexOf('.')
    if (NextDotIndex === -1) {
      return false
    }

    CurrentCandidate = CurrentCandidate.slice(NextDotIndex + 1)
  }

  return false
}

export function GetRuleCandidateDomains(Filter: AGTree.AnyRule): string[] {
  if (IsCosmeticRule(Filter)) {
    return [
      ...ExtractDomainListCandidates(Filter.domains),
      ...ExtractModifierDomainCandidates(Filter.modifiers)
    ]
  }

  if (IsNetworkRule(Filter)) {
    return [
      ...ExtractNetworkPatternCandidates(Filter.pattern.value),
      ...ExtractModifierDomainCandidates(Filter.modifiers)
    ]
  }

  return []
}

export function RuleMatchesUnifiedDomains(Filter: AGTree.AnyRule, UnifiedDomains: Set<string>): boolean {
  return GetRuleCandidateDomains(Filter).some(Candidate => DoesCandidateMatchUnifiedDomains(Candidate, UnifiedDomains))
}

export function FilterExternalRulesByDomains(FiltersList: AGTree.FilterList, UnifiedDomains: Set<string>): FilterExternalRulesResult {
  const MarkedIndexes = new Set<number>()
  const PendingHintIndexes: number[] = []
  const PreProcessorStack: PreProcessorFrame[] = []
  let KeptRules = 0
  let DroppedRules = 0
  let InvalidRules = 0

  for (let Index = 0; Index < FiltersList.children.length; Index += 1) {
    const Filter = FiltersList.children[Index]

    if (IsHintCommentRule(Filter)) {
      PendingHintIndexes.push(Index)
      continue
    }

    if (IsPreProcessorCommentRule(Filter)) {
      ProcessPreProcessor(Filter, Index, PreProcessorStack, MarkedIndexes)
      PendingHintIndexes.length = 0
      continue
    }

    if (Filter.category === AGTree.RuleCategory.Invalid) {
      InvalidRules += 1
      DroppedRules += 1
      PendingHintIndexes.length = 0
      continue
    }

    if (Filter.category === AGTree.RuleCategory.Empty || Filter.category === AGTree.RuleCategory.Comment) {
      PendingHintIndexes.length = 0
      continue
    }

    if (RuleMatchesUnifiedDomains(Filter, UnifiedDomains)) {
      KeptRules += 1
      MarkedIndexes.add(Index)
      for (const HintIndex of PendingHintIndexes) {
        MarkedIndexes.add(HintIndex)
      }
      MarkCurrentPreProcessorFrames(PreProcessorStack)
    } else {
      DroppedRules += 1
    }

    PendingHintIndexes.length = 0
  }

  for (const Frame of PreProcessorStack) {
    MarkPreProcessorFrame(Frame, MarkedIndexes)
  }

  return {
    Rules: FiltersList.children.filter((Filter, Index) => MarkedIndexes.has(Index)),
    KeptRules,
    DroppedRules,
    InvalidRules
  }
}

export async function LoadUnifiedExternalRules(
  FiltersListsConfig: FiltersListsConfigWithVersion,
  FiltersListDirectory: string
): Promise<UnifiedExternalRulesByAdblockType> {
  const UnifiedDefinitions = FiltersListsConfig.filter((Definition): Definition is UnifiedDefinition => {
    return typeof Definition.UnifiedDomainListFileName === 'string'
  })
  const ExternalRules: UnifiedExternalRulesByAdblockType = {}
  const SourceCache = new Map<string, ParsedExternalSource>()

  for (const Definition of UnifiedDefinitions) {
    const DomainListPath = Path.resolve(FiltersListDirectory, Definition.UnifiedDomainListFileName)
    const UnifiedDomains = ParseUnifiedDomains(Fs.readFileSync(DomainListPath, 'utf-8'))
    const Rules: AGTree.AnyRule[] = []

    if (UnifiedDomains.size === 0) {
      ActionCore.warning('[unified-external] ' + Definition.DefinitionFileName + ': ' + DomainListPath + ' has no domains; external imports skipped')
      ExternalRules[Definition.AdblockType] = Rules
      continue
    }

    ActionCore.info('[unified-external] ' + Definition.DefinitionFileName + ': loaded ' + UnifiedDomains.size + ' unified domains from ' + DomainListPath)

    for (const Source of GetUnifiedExternalSourceUrls(Definition.AdblockType)) {
      const ParsedSource = await LoadParsedExternalSource(Source, SourceCache)
      const FilteredSource = FilterExternalRulesByDomains(ParsedSource.FilterList, UnifiedDomains)
      Rules.push(...FilteredSource.Rules)
      ActionCore.info([
        '[unified-external] ' + Definition.AdblockType + ': ' + Source.Name,
        'kept=' + FilteredSource.KeptRules,
        'dropped=' + FilteredSource.DroppedRules,
        'invalid=' + FilteredSource.InvalidRules,
        'parseErrors=' + ParsedSource.ParseErrorCount
      ].join(' '))
    }

    ExternalRules[Definition.AdblockType] = Rules
    ActionCore.info('[unified-external] ' + Definition.DefinitionFileName + ': appended ' + Rules.length + ' external AST nodes')
  }

  return ExternalRules
}

async function LoadParsedExternalSource(Source: UnifiedExternalSource, SourceCache: Map<string, ParsedExternalSource>): Promise<ParsedExternalSource> {
  const CachedSource = SourceCache.get(Source.Url)
  if (CachedSource) {
    return CachedSource
  }

  ActionCore.info('[unified-external] Downloading ' + Source.Name + ' from ' + Source.Url)
  const Response = await SimpleSecureReq.Request(new URL(Source.Url), {
    HttpMethod: 'GET',
    ExpectedAs: 'String',
    FollowRedirects: true,
    MaxRedirects: 5,
    TimeoutMs: 60000
  }) as StringResponse

  if (Response.StatusCode < 200 || Response.StatusCode >= 300) {
    throw new Error('Failed to download ' + Source.Url + ': HTTP ' + Response.StatusCode)
  }

  const ParseErrors: unknown[] = []
  const FilterList = AGTree.FilterListParser.parse(Response.Body, {
    ...ParserOptions,
    onParseError: ParseError => ParseErrors.push(ParseError)
  })
  const ParsedSource = {
    FilterList,
    ParseErrorCount: ParseErrors.length
  }

  SourceCache.set(Source.Url, ParsedSource)

  return ParsedSource
}

function ProcessPreProcessor(
  Filter: AGTree.PreProcessorCommentRule,
  Index: number,
  PreProcessorStack: PreProcessorFrame[],
  MarkedIndexes: Set<number>
): void {
  if (Filter.name.value === 'if') {
    PreProcessorStack.push({
      IfIndex: Index,
      HasKeptRule: false,
      HasKeptElseRule: false,
      IsElseBranch: false
    })
    return
  }

  if (Filter.name.value === 'else') {
    const CurrentFrame = PreProcessorStack[PreProcessorStack.length - 1]
    if (CurrentFrame) {
      CurrentFrame.ElseIndex = Index
      CurrentFrame.IsElseBranch = true
    }
    return
  }

  if (Filter.name.value === 'endif') {
    const CurrentFrame = PreProcessorStack.pop()
    if (CurrentFrame) {
      MarkPreProcessorFrame(CurrentFrame, MarkedIndexes, Index)
    }
  }
}

function MarkCurrentPreProcessorFrames(PreProcessorStack: PreProcessorFrame[]): void {
  for (const Frame of PreProcessorStack) {
    Frame.HasKeptRule = true
    if (Frame.IsElseBranch) {
      Frame.HasKeptElseRule = true
    }
  }
}

function MarkPreProcessorFrame(Frame: PreProcessorFrame, MarkedIndexes: Set<number>, EndIfIndex?: number): void {
  if (!Frame.HasKeptRule) {
    return
  }

  MarkedIndexes.add(Frame.IfIndex)
  if (typeof Frame.ElseIndex === 'number' && Frame.HasKeptElseRule) {
    MarkedIndexes.add(Frame.ElseIndex)
  }
  if (typeof EndIfIndex === 'number') {
    MarkedIndexes.add(EndIfIndex)
  }
}

function ExtractDomainListCandidates(DomainList?: AGTree.DomainList): string[] {
  const Candidates: string[] = []

  for (const Domain of DomainList?.children ?? []) {
    if (!Domain.exception) {
      Candidates.push(Domain.value)
    }
  }

  return Candidates
}

function ExtractModifierDomainCandidates(Modifiers?: AGTree.ModifierList): string[] {
  const Candidates: string[] = []

  for (const Modifier of Modifiers?.children ?? []) {
    if (!Modifier.value || (Modifier.name.value !== 'domain' && Modifier.name.value !== 'denyallow')) {
      continue
    }

    try {
      const DomainList = AGTree.DomainListParser.parse(Modifier.value.value, ParserOptions, Modifier.value.start ?? 0, '|')
      Candidates.push(...ExtractDomainListCandidates(DomainList))
    } catch {
      continue
    }
  }

  return Candidates
}

function ExtractNetworkPatternCandidates(Pattern: string): string[] {
  if (!Pattern.startsWith('||')) {
    return []
  }

  let Host = ''
  for (let Index = 2; Index < Pattern.length; Index += 1) {
    const Character = Pattern[Index]
    if (NetworkHostTerminatingChars.has(Character)) {
      break
    }

    Host += Character
  }

  return Host ? [Host] : []
}

function NormalizeCandidateDomain(RawDomain: string): string | null {
  let Domain = RawDomain.trim().toLowerCase()

  if (!Domain) {
    return null
  }

  if (Domain.startsWith('||')) {
    Domain = Domain.slice(2)
  }
  if (Domain.startsWith('*.')) {
    Domain = Domain.slice(2)
  }
  if (Domain.endsWith('^')) {
    Domain = Domain.slice(0, -1)
  }
  if (Domain.endsWith('.')) {
    Domain = Domain.slice(0, -1)
  }
  if (Domain.startsWith('/') || Domain.includes('/') || Domain.includes('*')) {
    return null
  }
  if (!AGTree.DomainUtils.isValidDomainOrHostname(Domain)) {
    return null
  }

  return Domain
}

function IsCosmeticRule(Filter: AGTree.AnyRule): Filter is AGTree.AnyCosmeticRule {
  return Filter.category === AGTree.RuleCategory.Cosmetic
}

function IsNetworkRule(Filter: AGTree.AnyRule): Filter is AGTree.NetworkRule {
  return Filter.category === AGTree.RuleCategory.Network && Filter.type === AGTree.NetworkRuleType.NetworkRule
}

function IsHintCommentRule(Filter: AGTree.AnyRule): Filter is AGTree.HintCommentRule {
  return Filter.type === 'HintCommentRule'
}

function IsPreProcessorCommentRule(Filter: AGTree.AnyRule): Filter is AGTree.PreProcessorCommentRule {
  return Filter.type === 'PreProcessorCommentRule'
}
