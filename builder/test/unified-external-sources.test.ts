import * as Path from 'node:path'
import * as Process from 'node:process'
import * as AGTree from '@adguard/agtree'
import Test from 'ava'
import { BuildBundledFiltersLists } from '../source/worker-bundle-core.ts'
import {
  DoesCandidateMatchUnifiedDomains,
  FilterExternalRulesByDomains,
  GetRuleCandidateDomains,
  ParseUnifiedDomains,
  RuleMatchesUnifiedDomains
} from '../source/unified-external-sources.ts'
import {
  DeduplicateUnifiedExternalSources,
  GetUnifiedExternalSourceUrls
} from '../source/unified-external-source-urls.ts'

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

Test('ParseUnifiedDomains ignores comments and normalizes domains', T => {
  const Domains = ParseUnifiedDomains([
    '! comment',
    '# comment',
    'Example.COM',
    '*.Wildcard.Example.ORG',
    '||Sub.Example.NET^',
    ''
  ].join('\n'))

  T.deepEqual([...Domains].sort(), ['example.com', 'sub.example.net', 'wildcard.example.org'])
})

Test('DoesCandidateMatchUnifiedDomains matches subdomains', T => {
  const Domains = new Set(['example.com'])

  T.is(DoesCandidateMatchUnifiedDomains('ads.example.com', Domains), true)
  T.is(DoesCandidateMatchUnifiedDomains('example.net', Domains), false)
})

Test('RuleMatchesUnifiedDomains reads $domain and ignores excluded domains', T => {
  const MatchingRule = ParseRule('||tracker.example.net^$domain=example.com|~ignored.example.com')
  const ExcludedOnlyRule = ParseRule('||tracker.example.net^$domain=~example.com')
  const Domains = new Set(['example.com'])

  T.is(RuleMatchesUnifiedDomains(MatchingRule, Domains), true)
  T.is(RuleMatchesUnifiedDomains(ExcludedOnlyRule, Domains), false)
})

Test('RuleMatchesUnifiedDomains reads $denyallow and ignores excluded domains', T => {
  const MatchingRule = ParseRule('||tracker.example.net^$denyallow=example.com|~ignored.example.com')
  const ExcludedOnlyRule = ParseRule('||tracker.example.net^$denyallow=~example.com')
  const Domains = new Set(['example.com'])

  T.is(RuleMatchesUnifiedDomains(MatchingRule, Domains), true)
  T.is(RuleMatchesUnifiedDomains(ExcludedOnlyRule, Domains), false)
})

Test('GetRuleCandidateDomains extracts canonical network host patterns', T => {
  const Rule = ParseRule('||ads.sub.example.com^$script')
  const WildcardRule = ParseRule('||*.sub.example.com^$script')
  const PathRule = ParseRule('||ads.sub.example.com/path$script')

  T.deepEqual(GetRuleCandidateDomains(Rule), ['ads.sub.example.com'])
  T.deepEqual(GetRuleCandidateDomains(WildcardRule), ['*.sub.example.com'])
  T.deepEqual(GetRuleCandidateDomains(PathRule), ['ads.sub.example.com'])
  T.is(RuleMatchesUnifiedDomains(Rule, new Set(['example.com'])), true)
  T.is(RuleMatchesUnifiedDomains(WildcardRule, new Set(['example.com'])), true)
  T.is(RuleMatchesUnifiedDomains(PathRule, new Set(['example.com'])), true)
})

Test('FilterExternalRulesByDomains preserves matching hints and if branch wrappers', T => {
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

  T.deepEqual(RawTexts(FilteredList), [
    '!#if env_chromium',
    '!+ PLATFORM(ext_ublock)',
    'example.com##.ad',
    '!#endif'
  ])
})

Test('FilterExternalRulesByDomains preserves matching else branch wrappers', T => {
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

  T.deepEqual(RawTexts(FilteredList), [
    '!#if env_chromium',
    '!#else',
    'other.com##.ad',
    '!#endif'
  ])
})

Test('ResolveForPlatform handles #else branches', T => {
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

  T.deepEqual(RawTexts(Builder.Resolve(FiltersList, { env_chromium: true })), ['chromium.example##.ad'])
  T.deepEqual(RawTexts(Builder.Resolve(FiltersList, { env_chromium: false })), ['firefox.example##.ad'])
})

Test('uBO external source selection uses the uAssets ads template set', T => {
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
    T.is(UboUrls.some(Url => Url.endsWith('/uAssets/filters/' + FilterFileName)), true)
  }

  T.is(UboUrls.some(Url => Url.includes('/BaseFilter/')), false)
  T.is(UboUrls.some(Url => Url.includes('/SpywareFilter/sections/')), true)
  T.is(UboUrls.some(Url => Url.includes('/TrackParamFilter/sections/')), true)
})

Test('DeduplicateUnifiedExternalSources keeps the first source for duplicate URLs', T => {
  const Sources = DeduplicateUnifiedExternalSources([
    { Name: 'first', Url: 'https://example.com/filter.txt' },
    { Name: 'duplicate', Url: 'https://example.com/filter.txt' },
    { Name: 'second', Url: 'https://example.com/second.txt' }
  ])

  T.deepEqual(Sources, [
    { Name: 'first', Url: 'https://example.com/filter.txt' },
    { Name: 'second', Url: 'https://example.com/second.txt' }
  ])
})
