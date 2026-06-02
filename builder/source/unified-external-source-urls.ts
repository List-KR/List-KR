export type UnifiedExternalSourceAdblockType = 'AdGuard' | 'uBlockOrigin'

export type UnifiedExternalSource = {
  Name: string
  Url: string
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

export function GetUnifiedExternalSourceUrls(AdblockTypeValue: UnifiedExternalSourceAdblockType): UnifiedExternalSource[] {
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

export function DeduplicateUnifiedExternalSources(Sources: UnifiedExternalSource[]): UnifiedExternalSource[] {
  const SeenUrls = new Set<string>()
  const DeduplicatedSources: UnifiedExternalSource[] = []

  for (const Source of Sources) {
    if (SeenUrls.has(Source.Url)) {
      continue
    }

    SeenUrls.add(Source.Url)
    DeduplicatedSources.push(Source)
  }

  return DeduplicatedSources
}
