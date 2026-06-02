import * as Assert from 'node:assert/strict'
import * as Test from 'node:test'
import * as Path from 'node:path'
import * as Process from 'node:process'
import * as AGTree from '@adguard/agtree'
import { BuildBundledFiltersLists } from '../source/worker-bundle-core.ts'
import {
  DoesCandidateMatchUnifiedDomains,
  FilterExternalRulesByDomains,
  GetRuleCandidateDomains,
  GetUnifiedExternalSourceUrls,
  ParseUnifiedDomains,
  RuleMatchesUnifiedDomains
} from '../source/unified-external-sources.ts'

const ParserOptions: AGTree.ParserOptions = {
  ...AGTree.defaultParserOptions,
  parseAbpSpecificRules: true,
  parseUboSpecificRules: true,
  includeRaws: true
}

class TestBuilder extends BuildBundledFiltersLists {
  Resolve(FiltersList: AGTree.FilterList, Vars: Record<string, boolean>): AGTree.FilterList {
    return this.ResolveForPlatform(FiltersList, Vars)
  }
}

function ParseRule(RawRule: string): AGTree.AnyRule {
  return AGTree.RuleParser.parse(RawRule, ParserOptions)
}

function ParseFilterList(RawFilterList: string): AGTree.FilterList {
  return AGTree.FilterListParser.parse(RawFilterList, ParserOptions)
}

function RawTexts(FiltersList: AGTree.FilterList): string[] {
  return FiltersList.children.map(Filter => Filter.raws?.text ?? AGTree.RuleGenerator.generate(Filter))
}

Test.test('ParseUnifiedDomains ignores comments and normalizes domains', () => {
  const Domains = ParseUnifiedDomains([
    '! comment',
    '# comment',
    'Example.COM',
    '*.Wildcard.Example.ORG',
    '||Sub.Example.NET^',
    ''
  ].join('\n'))

  Assert.deepEqual([...Domains].sort(), ['example.com', 'sub.example.net', 'wildcard.example.org'])
})

Test.test('DoesCandidateMatchUnifiedDomains matches subdomains', () => {
  const Domains = new Set(['example.com'])

  Assert.equal(DoesCandidateMatchUnifiedDomains('ads.example.com', Domains), true)
  Assert.equal(DoesCandidateMatchUnifiedDomains('example.net', Domains), false)
})

Test.test('RuleMatchesUnifiedDomains reads $domain and ignores excluded domains', () => {
  const MatchingRule = ParseRule('||tracker.example.net^$domain=example.com|~ignored.example.com')
  const ExcludedOnlyRule = ParseRule('||tracker.example.net^$domain=~example.com')
  const Domains = new Set(['example.com'])

  Assert.equal(RuleMatchesUnifiedDomains(MatchingRule, Domains), true)
  Assert.equal(RuleMatchesUnifiedDomains(ExcludedOnlyRule, Domains), false)
})

Test.test('RuleMatchesUnifiedDomains reads $denyallow and ignores excluded domains', () => {
  const MatchingRule = ParseRule('||tracker.example.net^$denyallow=example.com|~ignored.example.com')
  const ExcludedOnlyRule = ParseRule('||tracker.example.net^$denyallow=~example.com')
  const Domains = new Set(['example.com'])

  Assert.equal(RuleMatchesUnifiedDomains(MatchingRule, Domains), true)
  Assert.equal(RuleMatchesUnifiedDomains(ExcludedOnlyRule, Domains), false)
})

Test.test('GetRuleCandidateDomains extracts canonical network host patterns', () => {
  const Rule = ParseRule('||ads.sub.example.com^$script')
  const WildcardRule = ParseRule('||*.sub.example.com^$script')
  const PathRule = ParseRule('||ads.sub.example.com/path$script')

  Assert.deepEqual(GetRuleCandidateDomains(Rule), ['ads.sub.example.com'])
  Assert.deepEqual(GetRuleCandidateDomains(WildcardRule), ['*.sub.example.com'])
  Assert.deepEqual(GetRuleCandidateDomains(PathRule), ['ads.sub.example.com'])
  Assert.equal(RuleMatchesUnifiedDomains(Rule, new Set(['example.com'])), true)
  Assert.equal(RuleMatchesUnifiedDomains(WildcardRule, new Set(['example.com'])), true)
  Assert.equal(RuleMatchesUnifiedDomains(PathRule, new Set(['example.com'])), true)
})

Test.test('FilterExternalRulesByDomains preserves matching hints and if branch wrappers', () => {
  const FiltersList = ParseFilterList([
    '!#if env_chromium',
    '!+ PLATFORM(ext_ublock)',
    'example.com##.ad',
    '!#else',
    'other.com##.ad',
    '!#endif'
  ].join('\n'))
  const FilteredList = {
    ...FiltersList,
    children: FilterExternalRulesByDomains(FiltersList, new Set(['example.com'])).Rules
  }

  Assert.deepEqual(RawTexts(FilteredList), [
    '!#if env_chromium',
    '!+ PLATFORM(ext_ublock)',
    'example.com##.ad',
    '!#endif'
  ])
})

Test.test('FilterExternalRulesByDomains preserves matching else branch wrappers', () => {
  const FiltersList = ParseFilterList([
    '!#if env_chromium',
    'example.com##.ad',
    '!#else',
    'other.com##.ad',
    '!#endif'
  ].join('\n'))
  const FilteredList = {
    ...FiltersList,
    children: FilterExternalRulesByDomains(FiltersList, new Set(['other.com'])).Rules
  }

  Assert.deepEqual(RawTexts(FilteredList), [
    '!#if env_chromium',
    '!#else',
    'other.com##.ad',
    '!#endif'
  ])
})

Test.test('ResolveForPlatform handles #else branches', () => {
  const Builder = new TestBuilder({
    FiltersProcessableCache: new Map(),
    WorkingDirectory: Process.cwd(),
    FiltersListDirectory: Path.resolve(Process.cwd(), 'filterslists'),
    UnifiedExternalRules: {}
  })
  const FiltersList = ParseFilterList([
    '!#if env_chromium',
    'chromium.example##.ad',
    '!#else',
    'firefox.example##.ad',
    '!#endif'
  ].join('\n'))

  Assert.deepEqual(RawTexts(Builder.Resolve(FiltersList, { env_chromium: true })), ['chromium.example##.ad'])
  Assert.deepEqual(RawTexts(Builder.Resolve(FiltersList, { env_chromium: false })), ['firefox.example##.ad'])
})

Test.test('uBO external source selection uses the uAssets ads template set', () => {
  const UboSources = GetUnifiedExternalSourceUrls('uBlockOrigin')
  const UboUrls = UboSources.map(Source => Source.Url)

  for (const FilterFileName of [
    'filters.txt',
    'filters-general.txt',
    'filters-2020.txt',
    'filters-2021.txt',
    'filters-2022.txt',
    'filters-2023.txt',
    'filters-2024.txt',
    'filters-2025.txt',
    'filters-2026.txt'
  ]) {
    Assert.equal(UboUrls.some(Url => Url.endsWith('/uAssets/filters/' + FilterFileName)), true)
  }

  Assert.equal(UboUrls.some(Url => Url.includes('/BaseFilter/')), false)
  Assert.equal(UboUrls.some(Url => Url.includes('/SpywareFilter/sections/')), true)
  Assert.equal(UboUrls.some(Url => Url.includes('/TrackParamFilter/sections/')), true)
})
