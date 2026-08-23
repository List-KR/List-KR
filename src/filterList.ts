import path from "node:path";
import {readdirSync} from "node:fs";
import {readFile, writeFile, mkdir} from "node:fs/promises";
import * as AGTree from "@adguard/agtree";
import type {FiltersListsConfigEntry} from "./config";

const parseOptions: AGTree.ParserOptions = {parseUboSpecificRules: true};
const unsupportedDnsModifiers = new Set(["third-party", "3p", "document", "doc", "all", "popup", "network"]);

export async function parseFilterList(filePath: string): Promise<AGTree.FilterList> {
    return AGTree.FilterListParser.parse(await readFile(filePath, "utf-8"), parseOptions);
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
    const tree = AGTree.FilterListParser.parse(await readFile(filePath, "utf-8"), parseOptions);
    return tree.children.some(
        c => c.type === "PreProcessorCommentRule" && c.name.value === "include"
            || typeof c.category === "string" && c.category !== "Empty" && c.category !== "Comment"
    );
}

export function scanFilterFiles(filtersListDir: string): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const ent of readdirSync(dir, {withFileTypes: true})) {
            const p = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(p);
            else if (ent.name.endsWith(".txt")) out.push(p);
        }
    };
    walk(filtersListDir);
    return out;
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

export function prepareDnsFilterList(list: AGTree.FilterList, exclusions: readonly string[]): AGTree.FilterList {
    const excludedRules = new Set(exclusions);
    const seenRules = new Set<string>();
    const children = list.children.flatMap((rule): AGTree.AnyRule[] => {
        if (rule.type !== "NetworkRule") return [rule];

        let normalized: AGTree.NetworkRule = rule;
        if (rule.modifiers) {
            const modifiers = rule.modifiers.children.filter(({name}) => !unsupportedDnsModifiers.has(name.value));
            if (modifiers.length !== rule.modifiers.children.length) normalized = {
                ...rule,
                raws: undefined,
                modifiers: modifiers.length > 0 ? {...rule.modifiers, children: modifiers} : undefined
            };
        }

        const text = AGTree.RuleGenerator.generate(normalized);
        if (excludedRules.has(text) || seenRules.has(text)) return [];
        seenRules.add(text);
        return [normalized];
    });
    return {...list, children};
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

export async function buildDefinition(
    entry: FiltersListsConfigEntry,
    filtersListDir: string,
    outputDir: string,
    processableCache: Map<string, boolean>
): Promise<string> {
    const defPath = path.resolve(filtersListDir, entry.definitionFileName);
    const parsed = await parseFilterList(defPath);
    const bundled = await bundleIncludes(parsed, filtersListDir, processableCache);
    const prepared = entry.adblockType === "DNS" ? prepareDnsFilterList(bundled, entry.exclusions) : bundled;
    const header = buildHeader(entry);
    const body = header + stringifyFilterList(prepared);
    const outPath = path.resolve(outputDir, entry.definitionFileName);
    await mkdir(path.dirname(outPath), {recursive: true});
    await writeFile(outPath, body);
    return outPath;
}
