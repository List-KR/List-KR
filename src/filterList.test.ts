import assert from "node:assert/strict";
import path from "node:path";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import * as AGTree from "@adguard/agtree";
import {bundleIncludes, parseFilterList, prepareDnsFilterList, scanFilterFiles, stringifyFilterList} from "./filterList";

const filtersListDir = path.resolve(import.meta.dirname, "..", "filterslists");
const filterFiles = scanFilterFiles(filtersListDir);
const textArgPseudo = /:(?:-abp-contains|contains|has-text|matches-attr|matches-css(?:-after|-before)?|matches-path|matches-prop(?:erty)?|min-text-length|xpath|style|watch-attr)\(/g;

// Drops quoted strings and free-text pseudo-class arguments so only selector syntax remains.
function selectorSyntax(selector: string): string {
    let out = "";
    let i = 0;
    for (const m of selector.matchAll(textArgPseudo)) {
        if (m.index < i) continue;
        let j = m.index + m[0].length;
        for (let depth = 1; j < selector.length && depth > 0; j++) {
            if (selector[j] === "(") depth++;
            else if (selector[j] === ")") depth--;
        }
        out += selector.slice(i, m.index + m[0].length) + ")";
        i = j;
    }
    return (out + selector.slice(i)).replace(/"[^"]*"|'[^']*'/g, "\"\"");
}

test("cosmetic selectors have no typos that aglint misses", async () => {
    const problems: string[] = [];
    for (const file of filterFiles) {
        for (const rule of (await parseFilterList(file)).children) {
            if (rule.type !== "ElementHidingRule" && rule.type !== "CssInjectionRule") continue;
            const selector = selectorSyntax(rule.body.selectorList.value);
            // `)j`, `]x`: stray type selector glued to a compound; `:not(class)`: meant `:not([class])`
            if (/[\])][A-Za-z_]/.test(selector) || /:not\((?:class|id|href|src|target|data-[\w-]+)\)/.test(selector)) {
                problems.push(`${path.relative(filtersListDir, file)}: ${rule.body.selectorList.value}`);
            }
        }
    }
    assert.deepEqual(problems, []);
});

test("shared filter files contain no AdGuard-only [$modifier] rules", async () => {
    const problems: string[] = [];
    for (const file of filterFiles.filter(f => f.split(path.sep).includes("filters-share"))) {
        for (const line of (await readFile(file, "utf-8")).split(/\r?\n/)) {
            if (line.startsWith("[$")) problems.push(`${path.relative(filtersListDir, file)}: ${line}`);
        }
    }
    assert.deepEqual(problems, []);
});

test("every filter file is included by a definition", async () => {
    const included = new Set<string>();
    for (const file of filterFiles) {
        for (const [, target] of (await readFile(file, "utf-8")).matchAll(/^!#include\s+(\S+)/gm)) {
            included.add(path.resolve(filtersListDir, target!));
        }
    }
    const orphans = filterFiles.filter(f => path.dirname(f) !== filtersListDir && !included.has(f));
    assert.deepEqual(orphans.map(f => path.relative(filtersListDir, f)), []);
});

test("includes pointing to missing files fail the build", async () => {
    const list = AGTree.FilterListParser.parse("!#include missing.txt", {parseUboSpecificRules: true});

    await assert.rejects(bundleIncludes(list, "/filters", new Map()), /Included file not found: missing\.txt/);
});

test("DNS lists normalize modifiers, duplicates, and configured exclusions", () => {
    const removable = ["third-party", "3p", "document", "doc", "all", "popup", "network"];
    const supported = [
        "client=127.0.0.1", "denyallow=allowed.example", "dnstype=A", "dnsrewrite=NXDOMAIN;;",
        "important", "badfilter", "ctag=device_pc", "respgeo=US"
    ];
    const source = [
        ...removable.map(modifier => `||${modifier}.example^$${modifier}`),
        ...supported.map((modifier, index) => `||supported-${index}.example^$${modifier}`),
        "||third-party.example^",
        "||excluded.example^"
    ].join("\n");
    const list = AGTree.FilterListParser.parse(source, {parseUboSpecificRules: true});

    const result = prepareDnsFilterList(list, ["||excluded.example^"]);

    assert.deepEqual(
        stringifyFilterList(result).trim().split("\n"),
        [
            ...removable.map(modifier => `||${modifier}.example^`),
            ...supported.map((modifier, index) => `||supported-${index}.example^$${modifier}`)
        ]
    );
});

test("DNS lists reject unsupported modifiers", () => {
    for (const modifier of ["script", "image", "xmlhttprequest", "domain=example.com"]) {
        const list = AGTree.FilterListParser.parse(`||unsupported.example^$${modifier}`, {
            parseUboSpecificRules: true
        });

        assert.throws(() => prepareDnsFilterList(list, []), /Unsupported DNS modifier/);
    }
});
