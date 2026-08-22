import {readFile} from "node:fs/promises";

export type AdblockType = "AdGuard" | "uBlockOrigin" | "DNS"

export type FiltersListsConfigEntry = {
    name: string
    definitionFileName: string
    description: string
    expireDuration: number
    homepageUrl: string
    supportUrl: string
    licenseUrl: string
    adblockType: AdblockType
}

export type FiltersListsConfig = FiltersListsConfigEntry[]

type RawDefaults = {
    homepageUrl?: unknown
    supportUrl?: unknown
    licenseUrl?: unknown
    expireDuration?: unknown
}

type RawDefinition = RawDefaults & {
    name?: unknown
    definitionFileName?: unknown
    description?: unknown
    adblockType?: unknown
}

function asString(v: unknown, field: string): string {
    if (typeof v !== "string") throw new Error(`Config ${field} must be string`);
    return v;
}

function asAdblockType(v: unknown): AdblockType {
    if (v !== "AdGuard" && v !== "uBlockOrigin" && v !== "DNS") throw new Error(`Invalid adblockType: ${v}`);
    return v;
}

export async function loadFiltersListsConfig(configPath: string): Promise<FiltersListsConfig> {
    const raw = JSON.parse(await readFile(configPath, "utf-8")) as unknown;
    if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { definitions?: unknown }).definitions)) {
        throw new Error("Config must be an object with a \"definitions\" array");
    }

    const root = raw as { definitions: RawDefinition[] } & RawDefaults;
    const defaults: RawDefaults = root;

    return root.definitions.map((item: RawDefinition): FiltersListsConfigEntry => {
        if (typeof item.name !== "string" || typeof item.definitionFileName !== "string") {
            throw new Error("Invalid config entry: missing name or definitionFileName");
        }
        return {
            name: item.name,
            definitionFileName: item.definitionFileName,
            description: typeof item.description === "string" ? item.description : "",
            expireDuration: typeof item.expireDuration === "number"
                ? item.expireDuration
                : typeof defaults.expireDuration === "number" ? defaults.expireDuration : 1,
            homepageUrl: typeof item.homepageUrl === "string" ? item.homepageUrl : asString(defaults.homepageUrl, "homepageUrl"),
            supportUrl: typeof item.supportUrl === "string" ? item.supportUrl : asString(defaults.supportUrl, "supportUrl"),
            licenseUrl: typeof item.licenseUrl === "string" ? item.licenseUrl : asString(defaults.licenseUrl, "licenseUrl"),
            adblockType: asAdblockType(item.adblockType)
        };
    });
}
