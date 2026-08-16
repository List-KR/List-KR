import path from "node:path";
import {readFile} from "node:fs/promises";
import * as AGTree from "@adguard/agtree";
import type {AdblockType, FiltersListsConfigEntry} from "./config";
import {getUnifiedExternalSourceUrls, type UnifiedExternalSource} from "./unifiedSources";

export type UnifiedExternalRulesByAdblockType = Partial<Record<AdblockType, AGTree.AnyRule[]>>

const denyallowModifierName = "denyallow";
const domainModifierName = "domain";
const domainModifierNames = new Set([denyallowModifierName, domainModifierName]);
const networkHostTerminatingChars = new Set([
    AGTree.ADBLOCK_URL_SEPARATOR,
    "/",
    AGTree.NETWORK_RULE_SEPARATOR,
    ":",
    "?",
    "#",
    "[",
    "]",
    "\\"
]);

const FETCH_TIMEOUT_MS = 60_000;

const parserOptions: AGTree.ParserOptions = {
    ...AGTree.defaultParserOptions,
    tolerant: true,
    parseAbpSpecificRules: true,
    parseUboSpecificRules: true,
    includeRaws: true
};

export function parseUnifiedDomains(raw: string): Set<string> {
    const domains = new Set<string>();
    for (const line of raw.split(/\r?\n/u)) {
        const trimmed = line.trim().toLowerCase();
        if (!trimmed || trimmed.startsWith("!") || trimmed.startsWith("#")) continue;
        const d = normalizeCandidateDomain(trimmed);
        if (d) domains.add(d);
    }
    return domains;
}

function doesCandidateMatchUnifiedDomains(raw: string, unified: Set<string>): boolean {
    const c = normalizeCandidateDomain(raw);
    if (!c) return false;
    let cur = c;
    while (cur.length > 0) {
        if (unified.has(cur)) return true;
        const i = cur.indexOf(".");
        if (i === -1) return false;
        cur = cur.slice(i + 1);
    }
    return false;
}

function getRuleCandidateDomains(filter: AGTree.AnyRule): string[] {
    if (isCosmeticRule(filter)) {
        return [...extractDomainListCandidates(filter.domains), ...extractModifierDomainCandidates(filter.modifiers)];
    }
    if (isNetworkRule(filter)) {
        return [...extractNetworkPatternCandidates(filter), ...extractModifierDomainCandidates(filter.modifiers)];
    }
    return [];
}

function ruleMatchesUnifiedDomains(filter: AGTree.AnyRule, unified: Set<string>): boolean {
    return getRuleCandidateDomains(filter).some(c => doesCandidateMatchUnifiedDomains(c, unified));
}

type PreProcessorFrame = {
    ifIndex: number
    elseIndex?: number
    hasKeptRule: boolean
    hasKeptElseRule: boolean
    isElseBranch: boolean
}

function filterExternalRulesByDomains(list: AGTree.FilterList, unified: Set<string>): {
    rules: AGTree.AnyRule[]
    kept: number
    dropped: number
    invalid: number
} {
    const marked = new Set<number>();
    const pendingHints: number[] = [];
    const stack: PreProcessorFrame[] = [];
    let kept = 0;
    let dropped = 0;
    let invalid = 0;

    for (let i = 0; i < list.children.length; i += 1) {
        const f = list.children[i]!;

        if (isHintCommentRule(f)) {
            pendingHints.push(i);
            continue;
        }

        if (isPreProcessorCommentRule(f)) {
            processPreProcessor(f, i, stack, marked);
            pendingHints.length = 0;
            continue;
        }

        if (f.category === AGTree.RuleCategory.Invalid) {
            invalid += 1;
            dropped += 1;
            pendingHints.length = 0;
            continue;
        }

        if (f.category === AGTree.RuleCategory.Empty || f.category === AGTree.RuleCategory.Comment) {
            pendingHints.length = 0;
            continue;
        }

        if (ruleMatchesUnifiedDomains(f, unified)) {
            kept += 1;
            marked.add(i);
            for (const h of pendingHints) marked.add(h);
            markCurrentPreProcessorFrames(stack);
        } else {
            dropped += 1;
        }

        pendingHints.length = 0;
    }

    for (const frame of stack) markPreProcessorFrame(frame, marked);

    return {
        rules: list.children.filter((_, i) => marked.has(i)),
        kept,
        dropped,
        invalid
    };
}

export async function loadUnifiedExternalRules(
    config: FiltersListsConfigEntry[],
    filtersListDir: string
): Promise<UnifiedExternalRulesByAdblockType> {
    const unifiedDefs = config.filter(
        (d): d is FiltersListsConfigEntry & { unifiedDomainListFileName: string } =>
            typeof d.unifiedDomainListFileName === "string"
    );
    const out: UnifiedExternalRulesByAdblockType = {};
    const cache = new Map<string, { list: AGTree.FilterList; parseErrors: number }>();

    for (const def of unifiedDefs) {
        const domainListPath = path.resolve(filtersListDir, def.unifiedDomainListFileName);
        const domains = parseUnifiedDomains(await readFile(domainListPath, "utf-8"));
        const rules: AGTree.AnyRule[] = [];

        if (domains.size === 0) {
            console.warn(`[unified] ${def.definitionFileName}: ${domainListPath} has no domains; skipping external imports`);
            out[def.adblockType] = rules;
            continue;
        }

        console.log(`[unified] ${def.definitionFileName}: loaded ${domains.size} domains`);

        for (const source of getUnifiedExternalSourceUrls(def.adblockType)) {
            const parsed = await loadParsedExternalSource(source, cache);
            const filtered = filterExternalRulesByDomains(parsed.list, domains);
            rules.push(...filtered.rules);
            console.log(
                `[unified] ${def.adblockType} ${source.name}: kept=${filtered.kept} dropped=${filtered.dropped} invalid=${filtered.invalid} parseErrors=${parsed.parseErrors}`
            );
        }

        out[def.adblockType] = rules;
        console.log(`[unified] ${def.definitionFileName}: appended ${rules.length} external rules`);
    }

    return out;
}

async function loadParsedExternalSource(
    source: UnifiedExternalSource,
    cache: Map<string, { list: AGTree.FilterList; parseErrors: number }>
): Promise<{ list: AGTree.FilterList; parseErrors: number }> {
    const cached = cache.get(source.url);
    if (cached) return cached;

    console.log(`[unified] downloading ${source.name} from ${source.url}`);
    const res = await fetch(source.url, {signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)});
    if (!res.ok) throw new Error(`Failed to download ${source.url}: HTTP ${res.status}`);
    const body = await res.text();
    const errors: unknown[] = [];
    const list = AGTree.FilterListParser.parse(body, {...parserOptions, onParseError: e => errors.push(e)});
    const entry = {list, parseErrors: errors.length};
    cache.set(source.url, entry);
    return entry;
}

function processPreProcessor(
    f: AGTree.PreProcessorCommentRule,
    i: number,
    stack: PreProcessorFrame[],
    marked: Set<number>
): void {
    if (f.name.value === "if") {
        stack.push({ifIndex: i, hasKeptRule: false, hasKeptElseRule: false, isElseBranch: false});
        return;
    }
    if (f.name.value === "else") {
        const cur = stack[stack.length - 1];
        if (cur) {
            cur.elseIndex = i;
            cur.isElseBranch = true;
        }
        return;
    }
    if (f.name.value === "endif") {
        const cur = stack.pop();
        if (cur) markPreProcessorFrame(cur, marked, i);
    }
}

function markCurrentPreProcessorFrames(stack: PreProcessorFrame[]): void {
    for (const f of stack) {
        f.hasKeptRule = true;
        if (f.isElseBranch) f.hasKeptElseRule = true;
    }
}

function markPreProcessorFrame(f: PreProcessorFrame, marked: Set<number>, endifIndex?: number): void {
    if (!f.hasKeptRule) return;
    marked.add(f.ifIndex);
    if (typeof f.elseIndex === "number" && f.hasKeptElseRule) marked.add(f.elseIndex);
    if (typeof endifIndex === "number") marked.add(endifIndex);
}

function extractDomainListCandidates(list?: AGTree.DomainList): string[] {
    const out: string[] = [];
    for (const d of list?.children ?? []) {
        if (!d.exception) out.push(d.value);
    }
    return out;
}

function extractModifierDomainCandidates(modifiers?: AGTree.ModifierList): string[] {
    const out: string[] = [];
    for (const m of modifiers?.children ?? []) {
        if (!m.value || !domainModifierNames.has(m.name.value)) continue;
        const dl = parseDomainList(m.value.value, m.value.start ?? 0, AGTree.PIPE_MODIFIER_SEPARATOR);
        if (dl) out.push(...extractDomainListCandidates(dl));
    }
    return out;
}

function extractNetworkPatternCandidates(f: AGTree.NetworkRule): string[] {
    const p = f.pattern.value;
    if (!p.startsWith(AGTree.ADBLOCK_URL_START)) return [];
    let host = "";
    for (let i = AGTree.ADBLOCK_URL_START.length; i < p.length; i += 1) {
        const c = p[i]!;
        if (networkHostTerminatingChars.has(c)) break;
        host += c;
    }
    return host ? [host] : [];
}

function parseDomainList(raw: string, base: number, sep?: AGTree.DomainListSeparator): AGTree.DomainList | null {
    try {
        return AGTree.DomainListParser.parse(raw, parserOptions, base, sep);
    } catch {
        return null;
    }
}

function normalizeCandidateDomain(raw: string): string | null {
    let d = raw.trim().toLowerCase();
    if (!d) return null;
    if (d.startsWith(AGTree.ADBLOCK_URL_START)) d = d.slice(AGTree.ADBLOCK_URL_START.length);
    if (d.startsWith(AGTree.ADBLOCK_WILDCARD + ".")) d = d.slice((AGTree.ADBLOCK_WILDCARD + ".").length);
    if (d.endsWith(AGTree.ADBLOCK_URL_SEPARATOR)) d = d.slice(0, -1);
    if (d.endsWith(".")) d = d.slice(0, -1);
    if (d.startsWith("/") || d.includes("/") || d.includes("*")) return null;
    if (!AGTree.DomainUtils.isValidDomainOrHostname(d)) return null;
    return d;
}

function isCosmeticRule(f: AGTree.AnyRule): f is AGTree.AnyCosmeticRule {
    return f.category === AGTree.RuleCategory.Cosmetic;
}

function isNetworkRule(f: AGTree.AnyRule): f is AGTree.NetworkRule {
    return f.category === AGTree.RuleCategory.Network && f.type === AGTree.NetworkRuleType.NetworkRule;
}

function isHintCommentRule(f: AGTree.AnyRule): f is AGTree.HintCommentRule {
    return f.type === AGTree.CommentRuleType.HintCommentRule;
}

function isPreProcessorCommentRule(f: AGTree.AnyRule): f is AGTree.PreProcessorCommentRule {
    return f.type === AGTree.CommentRuleType.PreProcessorCommentRule;
}
