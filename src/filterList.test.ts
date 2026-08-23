import assert from "node:assert/strict";
import {test} from "node:test";
import * as AGTree from "@adguard/agtree";
import {prepareDnsFilterList, stringifyFilterList} from "./filterList";

test("DNS lists drop unsupported modifiers and configured exclusions", () => {
    const unsupported = ["third-party", "3p", "document", "doc", "all", "popup", "network"];
    const source = [
        ...unsupported.map(modifier => `||${modifier}.example^$${modifier}`),
        "||supported.example^$important",
        "||third-party.example^",
        "||excluded.example^"
    ].join("\n");
    const list = AGTree.FilterListParser.parse(source, {parseUboSpecificRules: true});

    const result = prepareDnsFilterList(list, ["||excluded.example^"]);

    assert.deepEqual(
        stringifyFilterList(result).trim().split("\n"),
        [
            ...unsupported.map(modifier => `||${modifier}.example^`),
            "||supported.example^$important"
        ]
    );
});
