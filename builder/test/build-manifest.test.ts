import * as AGTree from '@adguard/agtree'
import Test from 'ava'
import {
  CompareBuildManifests,
  CreateBuildManifest,
  CreateDefinitionManifestFromOutputs,
  CreateDefinitionVersionMap,
  NormalizeFilterListForContentHash,
  Sha384Hex
} from '../source/build-manifest.ts'
import { FilterExternalRulesByDomains } from '../source/unified-external-sources.ts'

const ParserOptions: AGTree.ParserOptions = {
  ...AGTree.defaultParserOptions,
  parseAbpSpecificRules: true,
  parseUboSpecificRules: true,
  includeRaws: true
}

function ParseFilterList(RawFilterList: string): AGTree.FilterList {
  return AGTree.FilterListParser.parse(RawFilterList, ParserOptions)
}

function RawTexts(FiltersList: AGTree.FilterList): string[] {
  return FiltersList.children.map(Filter => Filter.raws?.text ?? AGTree.RuleGenerator.generate(Filter))
}

Test('NormalizeFilterListForContentHash excludes only the Version header', T => {
  const VersionOne = [
    '! Title: List-KR test',
    '! Version: 2026.20610.0',
    'example.com##.ad'
  ].join('\n')
  const VersionTwo = VersionOne.replace('2026.20610.0', '2026.20610.1')
  const TitleChanged = VersionOne.replace('List-KR test', 'List-KR renamed')
  const RuleChanged = VersionOne.replace('example.com##.ad', 'example.com##.sponsor')

  T.is(
    Sha384Hex(NormalizeFilterListForContentHash(VersionOne)),
    Sha384Hex(NormalizeFilterListForContentHash(VersionTwo))
  )
  T.not(
    Sha384Hex(NormalizeFilterListForContentHash(VersionOne)),
    Sha384Hex(NormalizeFilterListForContentHash(TitleChanged))
  )
  T.not(
    Sha384Hex(NormalizeFilterListForContentHash(VersionOne)),
    Sha384Hex(NormalizeFilterListForContentHash(RuleChanged))
  )
})

Test('CompareBuildManifests and CreateDefinitionVersionMap update only changed definitions', T => {
  const PreviousManifest = CreateBuildManifest('1.0.0', [
    CreateDefinitionManifestFromOutputs('filterslist-AdGuard.txt', '1.0.0', [
      { Path: 'filterslist-AdGuard.txt', Body: '! Version: 1.0.0\nexample.com##.ad' }
    ]),
    CreateDefinitionManifestFromOutputs('filterslist-AdGuard-unified.txt', '1.0.0', [
      { Path: 'filterslist-AdGuard-unified.txt', Body: '! Version: 1.0.0\nexample.com##.ad' }
    ])
  ], '2026-01-01T00:00:00.000Z')
  const CurrentManifest = CreateBuildManifest('2.0.0', [
    CreateDefinitionManifestFromOutputs('filterslist-AdGuard.txt', '2.0.0', [
      { Path: 'filterslist-AdGuard.txt', Body: '! Version: 2.0.0\nexample.com##.ad' }
    ]),
    CreateDefinitionManifestFromOutputs('filterslist-AdGuard-unified.txt', '2.0.0', [
      { Path: 'filterslist-AdGuard-unified.txt', Body: '! Version: 2.0.0\nexample.com##.ad\nexample.net##.ad' }
    ])
  ], '2026-01-01T00:25:00.000Z')

  const Diff = CompareBuildManifests(PreviousManifest, CurrentManifest)
  const DefinitionVersionMap = CreateDefinitionVersionMap(PreviousManifest, CurrentManifest, Diff.ChangedDefinitionFileNames, '2.0.0')

  T.deepEqual(Diff.ChangedDefinitionFileNames, ['filterslist-AdGuard-unified.txt'])
  T.deepEqual(DefinitionVersionMap, {
    'filterslist-AdGuard.txt': '1.0.0',
    'filterslist-AdGuard-unified.txt': '2.0.0'
  })
})

Test('CompareBuildManifests treats a missing previous manifest as bootstrap', T => {
  const CurrentManifest = CreateBuildManifest('2.0.0', [
    CreateDefinitionManifestFromOutputs('filterslist-AdGuard.txt', '2.0.0', [
      { Path: 'filterslist-AdGuard.txt', Body: '! Version: 2.0.0\nexample.com##.ad' }
    ]),
    CreateDefinitionManifestFromOutputs('filterslist-uBlockOrigin.txt', '2.0.0', [
      { Path: 'filterslist-uBlockOrigin.txt', Body: '! Version: 2.0.0\nexample.com##.ad' }
    ])
  ], '2026-01-01T00:00:00.000Z')

  T.deepEqual(CompareBuildManifests(null, CurrentManifest).ChangedDefinitionFileNames, [
    'filterslist-AdGuard.txt',
    'filterslist-uBlockOrigin.txt'
  ])
})

Test('Nonmatching external rule changes do not change the filtered output hash', T => {
  const Domains = new Set(['example.com'])
  const PreviousExternal = ParseFilterList([
    'example.com##.ad',
    'other.example##.old-ad'
  ].join('\n'))
  const CurrentExternal = ParseFilterList([
    'example.com##.ad',
    'other.example##.new-ad'
  ].join('\n'))
  const PreviousFilteredBody = RawTexts({
    ...PreviousExternal,
    children: FilterExternalRulesByDomains(PreviousExternal, Domains).Rules
  }).join('\n')
  const CurrentFilteredBody = RawTexts({
    ...CurrentExternal,
    children: FilterExternalRulesByDomains(CurrentExternal, Domains).Rules
  }).join('\n')
  const PreviousDefinition = CreateDefinitionManifestFromOutputs('filterslist-AdGuard-unified.txt', '1.0.0', [
    { Path: 'filterslist-AdGuard-unified.txt', Body: '! Version: 1.0.0\n' + PreviousFilteredBody }
  ])
  const CurrentDefinition = CreateDefinitionManifestFromOutputs('filterslist-AdGuard-unified.txt', '2.0.0', [
    { Path: 'filterslist-AdGuard-unified.txt', Body: '! Version: 2.0.0\n' + CurrentFilteredBody }
  ])

  T.is(PreviousDefinition.combinedSha384, CurrentDefinition.combinedSha384)
})
