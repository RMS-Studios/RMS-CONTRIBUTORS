/*
 * RMS, a Discord client mod
 * Copyright (c) 2026 zxkuhl and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { Settings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

// Invisible characters
const ZWS = "\u200B"; // Zero Width Space
const ZWNJ = "\u200C"; // Zero Width Non-Joiner
const ZWJ = "\u200D"; // Zero Width Joiner
const SHY = "\u00AD"; // Soft Hyphen (invisible)
const WJ = "\u2060"; // Word Joiner (invisible)
// Unicode lookalikes
const LOOKALIKES: Record<string, string[]> = {
    "a": ["а", "ạ", "ă", "ā", "ą"],
    "A": ["А", "Á", "Â", "Ã", "Ā"],
    "b": ["Ƅ", "ƀ", "ɓ"],
    "B": ["В", "Ɓ", "ℬ"],
    "c": ["с", "ċ", "ć", "č"],
    "C": ["С", "Ć", "Č", "ℂ"],
    "d": ["ԁ", "ɗ", "ď"],
    "e": ["е", "ė", "ę", "ē", "ɇ"],
    "E": ["Е", "Ė", "Ē", "ℰ"],
    "g": ["ɡ", "ġ", "ĝ", "ǵ"],
    "h": ["հ", "ħ", "ĥ"],
    "H": ["Н", "Ĥ", "ℋ"],
    "i": ["і", "ï", "ī", "į"],
    "I": ["І", "Ï", "Ī", "ℐ"],
    "j": ["ϳ", "ĵ", "ɉ"],
    "k": ["κ", "ķ", "ƙ"],
    "K": ["Κ", "Ķ", "Ƙ"],
    "l": ["ӏ", "ļ", "ľ", "ĺ"],
    "m": ["м", "ɱ", "ᴍ"],
    "M": ["М", "ℳ", "Ɯ"],
    "n": ["ո", "ņ", "ň", "ń"],
    "N": ["Ν", "Ņ", "Ň", "ℕ"],
    "o": ["о", "ȯ", "ō", "ő", "ơ"],
    "O": ["О", "Ō", "Ő", "Ơ"],
    "p": ["р", "ƥ", "ᵽ"],
    "P": ["Р", "Ƥ", "ℙ"],
    "q": ["ԛ", "ɋ"],
    "r": ["ɾ", "ŗ", "ř", "ŕ"],
    "R": ["Ŗ", "Ř", "ℜ"],
    "s": ["ѕ", "ŝ", "š", "ś"],
    "S": ["Ѕ", "Š", "Ś", "ꜱ"],
    "t": ["т", "ţ", "ť", "ƭ"],
    "T": ["Т", "Ţ", "Ť", "ℸ"],
    "u": ["υ", "ū", "ű", "ų", "ư"],
    "U": ["Ս", "Ū", "Ű", "Ų"],
    "v": ["ν", "ṽ", "ᵥ"],
    "w": ["ԝ", "ŵ", "ɯ"],
    "W": ["Ԝ", "Ŵ", "ʍ"],
    "x": ["х", "ẋ", "χ"],
    "X": ["Х", "Χ", "ℵ"],
    "y": ["у", "ŷ", "ÿ", "ƴ"],
    "Y": ["Υ", "Ŷ", "Ÿ"],
    "z": ["ᴢ", "ź", "ž", "ż"],
    "Z": ["Ζ", "Ź", "Ž", "ℤ"],
};
const INVISIBLE = [ZWS, ZWNJ, ZWJ, SHY, WJ];
function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
function obfuscate(text: string): string {
    return text.split("").map((char, i) => {
        const lookalikes = LOOKALIKES[char];
        const replaced = lookalikes ? randomFrom(lookalikes) : char;
        const invisible = i % 2 === 0 ? randomFrom(INVISIBLE) : "";
        return replaced + invisible;
    }).join("");
}
export default definePlugin({
    name: "BypassFilter",
    description: "Replaces letters with unicode lookalikes and invisible characters to bypass automod. Looks completely normal to humans.",
    tags: ["Utility"],
    authors: [Devs.zxkuhl],
    dependencies: ["MessageEventsAPI"],
    options: {
        enabled: {
            type: OptionType.BOOLEAN,
            description: "Automatically bypass filter on all messages",
            default: false,
        },
    },
    start() {
        this.preSend = addMessagePreSendListener((channelId, msg) => {
            if (!Settings.plugins.BypassFilter.enabled) return;
            msg.content = obfuscate(msg.content);
        });
    },
    stop() {
        removeMessagePreSendListener(this.preSend);
    },
});
