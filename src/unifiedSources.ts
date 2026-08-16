export type UnifiedExternalSourceAdblockType = "AdGuard" | "uBlockOrigin"

export type UnifiedExternalSource = {
    name: string
    url: string
}

const adGuardPagesRoot = "https://adguardteam.github.io/AdguardFilters/";
const uAssetsFiltersRoot = "https://ublockorigin.github.io/uAssets/filters/";

const easyListSource: UnifiedExternalSource = {
    name: "EasyList/easylist.txt",
    url: "https://easylist-downloads.adblockplus.org/easylist.txt"
};

const adGuardBaseSections = [
    "general_elemhide.txt",
    "allowlist_stealth.txt",
    "foreign.txt",
    "adservers.txt",
    "general_extensions.txt",
    "content_blocker.txt",
    "general_url.txt",
    "allowlist.txt",
    "replace.txt",
    "cryptominers.txt",
    "specific.txt",
    "adservers_firstparty.txt",
    "antiadblock.txt",
    "banner_sizes.txt"
];

const adGuardTrackingProtectionSections = [
    "general_elemhide.txt",
    "cookies_general.txt",
    "tracking_servers.txt",
    "cookies_allowlist.txt",
    "general_extensions.txt",
    "general_url.txt",
    "allowlist.txt",
    "tracking_servers_firstparty.txt",
    "mobile.txt",
    "mobile_allowlist.txt",
    "specific.txt",
    "cookies_specific.txt"
];

const adGuardUrlTrackingSections = [
    "general_url.txt",
    "allowlist.txt",
    "specific.txt"
];

const uAssetsAdsFilterFiles = [
    "filters.txt",
    "filters-general.txt",
    "filters-2020.txt",
    "filters-2021.txt",
    "filters-2022.txt",
    "filters-2023.txt",
    "filters-2024.txt",
    "filters-2025.txt",
    "filters-2026.txt",
    "quick-fixes.txt"
];

function buildAdGuardSectionSources(dir: string, label: string, sections: string[]): UnifiedExternalSource[] {
    return sections.map(s => ({
        name: `${label}/${s}`,
        url: new URL(`${dir}/sections/${s}`, adGuardPagesRoot).toString()
    }));
}

function buildUAssetsFilterSources(files: string[]): UnifiedExternalSource[] {
    return files.map(f => ({
        name: `uAssets/${f}`,
        url: new URL(f, uAssetsFiltersRoot).toString()
    }));
}

export function getUnifiedExternalSourceUrls(type: UnifiedExternalSourceAdblockType): UnifiedExternalSource[] {
    const tracking = [
        ...buildAdGuardSectionSources("SpywareFilter", "AdGuard Tracking Protection", adGuardTrackingProtectionSections),
        ...buildAdGuardSectionSources("TrackParamFilter", "AdGuard URL Tracking", adGuardUrlTrackingSections)
    ];

    if (type === "uBlockOrigin") {
        return [...buildUAssetsFilterSources(uAssetsAdsFilterFiles), easyListSource, ...tracking];
    }

    return [...buildAdGuardSectionSources("BaseFilter", "AdGuard Base", adGuardBaseSections), easyListSource, ...tracking];
}
