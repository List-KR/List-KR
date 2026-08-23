import assert from "node:assert/strict";
import {test} from "node:test";
import * as AGTree from "@adguard/agtree";
import {prepareDnsFilterList, stringifyFilterList} from "./filterList";

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
