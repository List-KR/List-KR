import path from "node:path";
import * as AGTree from "@adguard/agtree";
import type {FiltersListsConfigEntry} from "./config";
import type {UnifiedExternalRulesByAdblockType} from "./unified";

const parseOptions: AGTree.ParserOptions = {parseUboSpecificRules: true};

export async function parseFilterList(filePath: string): Promise<AGTree.FilterList> {
    return AGTree.FilterListParser.parse(await Bun.file(filePath).text(), parseOptions);
}

export function stringifyFilterList(list: AGTree.FilterList): string {
    let out = "";
    for (let i = 0; i < list.children.length; i += 1) {
        const f = list.children[i]!;
        out += f.raws?.text ?? AGTree.RuleGenerator.generate(f);
        switch (f.raws?.nl) {
            case "crlf":
                out += "\r\n";
                break;
            case "cr":
                out += "\r";
                break;
            case "lf":
                out += "\n";
                break;
            default:
                if (i !== list.children.length - 1) out += "\n";
                break;
        }
    }
    return out;
}

export async function isProcessable(filePath: string): Promise<boolean> {
    const tree = AGTree.FilterListParser.parse(await Bun.file(filePath).text(), parseOptions);
    return tree.children.some(
        c => typeof c.category === "string" && c.category !== "Empty" && c.category !== "Comment"
    );
}

export function scanFilterFiles(filtersListDir: string): string[] {
    const glob = new Bun.Glob("**/*.txt");
    return [...glob.scanSync({cwd: filtersListDir, absolute: true})];
}

function isPreProcessorCommentRule(f: AGTree.AnyRule): f is AGTree.PreProcessorCommentRule {
    return f.type === "PreProcessorCommentRule";
}

export async function bundleIncludes(
    list: AGTree.FilterList,
    filtersListDir: string,
    processableCache: Map<string, boolean>
): Promise<AGTree.FilterList> {
    const out: AGTree.AnyRule[] = [];
    for (const f of list.children) {
        if (!isPreProcessorCommentRule(f) || f.name.value !== "include" || !f.params || f.params.type !== "Value") {
            out.push(f);
            continue;
        }
        const includePath = path.resolve(filtersListDir, f.params.value);
        if (!processableCache.get(includePath)) continue;
        const included = await bundleIncludes(await parseFilterList(includePath), filtersListDir, processableCache);
        out.push(...included.children);
    }
    return {...list, children: out};
}

export function buildHeader(entry: FiltersListsConfigEntry, now = new Date()): string {
    const expiresLabel = entry.expireDuration === 1 ? "day" : "days";
    return [
        `! Title: ${entry.name}`,
        `! Description: ${entry.description}`,
        `! Last modified: ${now.toISOString()}`,
        `! Expires: ${entry.expireDuration} ${expiresLabel} (update frequency)`,
        `! Homepage: ${entry.homepageUrl}`,
        `! License: ${entry.licenseUrl}`,
        ""
    ].join("\n");
}

export function appendUnifiedExternalRules(
    list: AGTree.FilterList,
    entry: FiltersListsConfigEntry,
    externalRules: UnifiedExternalRulesByAdblockType
): AGTree.FilterList {
    if (!entry.unifiedDomainListFileName) return list;
    const rules = externalRules[entry.adblockType] ?? [];
    if (rules.length === 0) return list;
    console.log(`Appending ${rules.length} unified external rules for ${entry.definitionFileName}`);
    return {...list, children: [...list.children, ...rules]};
}

export async function buildDefinition(
    entry: FiltersListsConfigEntry,
    filtersListDir: string,
    outputDir: string,
    processableCache: Map<string, boolean>,
    externalRules: UnifiedExternalRulesByAdblockType
): Promise<string> {
    const defPath = path.resolve(filtersListDir, entry.definitionFileName);
    const parsed = await parseFilterList(defPath);
    const bundled = appendUnifiedExternalRules(
        await bundleIncludes(parsed, filtersListDir, processableCache),
        entry,
        externalRules
    );
    const header = buildHeader(entry);
    const body = header + stringifyFilterList(bundled);
    const outPath = path.resolve(outputDir, entry.definitionFileName);
    await Bun.write(outPath, body);
    return outPath;
}
