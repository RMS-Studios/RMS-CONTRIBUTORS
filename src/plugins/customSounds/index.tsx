/*
 * RMS, a modification for Discord's desktop app
 * Copyright (c) 2022 zxkuhl and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Forms } from "@webpack/common";

// ─── Sound keys ───────────────────────────────────────────────────────────────

export const SOUND_KEYS = [
    "message_received",
    "message_sent",
    "mention_ping",
    "call_incoming",
    "call_ended",
    "user_join_voice",
    "user_leave_voice",
    "mute",
    "unmute",
    "deafen",
    "undeafen",
] as const;

export type SoundKey = typeof SOUND_KEYS[number];

const SOUND_LABELS: Record<SoundKey, string> = {
    message_received: "Message Received",
    message_sent: "Message Sent",
    mention_ping: "Mention / Ping",
    call_incoming: "Call Incoming",
    call_ended: "Call Ended",
    user_join_voice: "User Join Voice",
    user_leave_voice: "User Leave Voice",
    mute: "Mute",
    unmute: "Unmute",
    deafen: "Deafen",
    undeafen: "Undeafen",
};

// Maps our key → Discord's internal sound name used in SoundModule.playSound()
const DISCORD_SOUND_EVENTS: Record<SoundKey, string> = {
    message_received: "message1",
    message_sent: "message2",
    mention_ping: "mention1",
    call_incoming: "call_ringing",
    call_ended: "call_calling",
    user_join_voice: "user_join",
    user_leave_voice: "user_leave",
    mute: "mute",
    unmute: "unmute",
    deafen: "deafen",
    undeafen: "undeafen",
};

// Supported audio extensions for local file validation
const SUPPORTED_EXTENSIONS = [".mp3", ".ogg", ".wav", ".flac", ".aac", ".m4a", ".opus", ".webm"];

// ─── Settings ─────────────────────────────────────────────────────────────────

function soundSetting(key: SoundKey) {
    return {
        type: OptionType.STRING,
        description: `"${SOUND_LABELS[key]}" — local path or URL. Leave blank to keep Discord's default.`,
        default: "",
    } as const;
}

const settings = definePluginSettings({
    volume: {
        type: OptionType.SLIDER,
        description: "Master volume for all custom sounds (0–100)",
        markers: [0, 10, 25, 50, 75, 100],
        default: 80,
    },
    message_received: soundSetting("message_received"),
    message_sent: soundSetting("message_sent"),
    mention_ping: soundSetting("mention_ping"),
    call_incoming: soundSetting("call_incoming"),
    call_ended: soundSetting("call_ended"),
    user_join_voice: soundSetting("user_join_voice"),
    user_leave_voice: soundSetting("user_leave_voice"),
    mute: soundSetting("mute"),
    unmute: soundSetting("unmute"),
    deafen: soundSetting("deafen"),
    undeafen: soundSetting("undeafen"),
});

// ─── Path → URL resolution (no native.ts needed) ──────────────────────────────

/**
 * Converts a raw user input string into a playable URL — entirely in the
 * renderer, no main-process round-trip required.
 *
 *  • http/https  → returned as-is
 *  • file://     → returned as-is
 *  • Local path  → validated, normalised, converted to file://
 */
function resolveToUrl(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Already a full URL
    if (/^https?:\/\//i.test(trimmed) || /^file:\/\//i.test(trimmed)) {
        return trimmed;
    }

    // Local path — check extension first
    const lower = trimmed.toLowerCase();
    const hasValidExt = SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
    if (!hasValidExt) {
        console.warn(
            `[CustomSounds] Unsupported file extension: "${trimmed}". ` +
            `Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`
        );
        return null;
    }

    let normalised = trimmed;

    // Expand ~ on macOS/Linux using Electron's process.env in the renderer
    if (normalised.startsWith("~")) {
        const home =
            (typeof process !== "undefined"
                ? (process.env.HOME ?? process.env.USERPROFILE)
                : null) ?? "";
        normalised = home + normalised.slice(1);
    }

    // Convert Windows backslashes → forward slashes
    normalised = normalised.replace(/\\/g, "/");

    // Ensure leading slash (Windows: "C:/…" → "/C:/…")
    if (!normalised.startsWith("/")) normalised = "/" + normalised;

    // Percent-encode path segments (handles spaces, brackets, etc.)
    // but preserve / and : so drive letters (C:) and separators survive.
    const encoded = normalised
        .split("/")
        .map(seg => encodeURIComponent(seg).replace(/%3A/gi, ":"))
        .join("/");

    return `file://${encoded}`;
}

// ─── Audio playback ───────────────────────────────────────────────────────────

/** One Audio instance per key — allows stopping overlapping playback. */
const audioInstances: Partial<Record<SoundKey, HTMLAudioElement>> = {};

/**
 * Tries to play the custom sound for `key`.
 * Returns true  → played successfully; caller should suppress Discord's default.
 * Returns false → no sound configured or playback failed; let Discord handle it.
 */
async function playCustomSound(key: SoundKey): Promise<boolean> {
    const raw: string = (settings.store as any)[key] ?? "";
    const url = resolveToUrl(raw);
    if (!url) return false;

    // Stop any previous overlapping instance
    const prev = audioInstances[key];
    if (prev) {
        prev.pause();
        prev.currentTime = 0;
    }

    const audio = new Audio(url);
    audio.volume = Math.max(0, Math.min(1, settings.store.volume / 100));
    audioInstances[key] = audio;

    try {
        await audio.play();
        return true;
    } catch (err) {
        console.error(`[CustomSounds] Failed to play "${key}" (${url}):`, err);
        return false;
    }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "CustomSounds",
    description: "Replace Discord's notification and UI sounds with your own audio files (local paths or URLs).",
    tags: ["Notifications", "Voice"],
    authors: [Devs.Xjay],

    settings,

    patches: [
        {
            // Intercept SoundModule.playSound(name, volume) globally.
            // Every Discord sound goes through this single call site.
            find: "SoundModule",
            replacement: {
                match: /(\i)\.playSound\((\i),(\i)\)/,
                replace: "$self._interceptRaw($1,$2,$3)",
            },
            noWarn: true,
        },
    ],

    settingsAboutComponent() {
        return (
            <>
                <Forms.FormText>
                    Enter a <strong>local file path</strong> or a <strong>remote URL</strong> for each sound.
                    Leave blank to keep Discord's default.
                </Forms.FormText>
                <Forms.FormText style={{ marginTop: 8, color: "var(--text-muted)" }}>
                    <strong>Windows:</strong> <code>C:\Users\you\sounds\ping.mp3</code><br />
                    <strong>macOS / Linux:</strong> <code>~/sounds/ping.mp3</code> or <code>/home/you/sounds/ping.mp3</code><br />
                    <strong>URL:</strong> <code>https://example.com/ping.mp3</code>
                </Forms.FormText>
                <Forms.FormText style={{ marginTop: 8, color: "var(--text-muted)" }}>
                    Supported formats: <code>mp3 · ogg · wav · flac · aac · m4a · opus · webm</code>
                </Forms.FormText>
            </>
        );
    },

    /**
     * Called from the Webpack patch instead of SoundModule.playSound().
     * Checks whether we have a custom sound for the given Discord sound name,
     * plays it if so, and falls back to the original call if not.
     */
    _interceptRaw(soundModule: any, name: string, volume: number) {
        // Find which of our keys corresponds to this Discord sound name
        const entry = (Object.entries(DISCORD_SOUND_EVENTS) as [SoundKey, string][])
            .find(([, discordName]) => discordName === name);

        if (!entry) {
            // Unknown sound — not one we manage, pass through
            return soundModule?.playSound?.(name, volume);
        }

        const [key] = entry;
        const raw: string = (settings.store as any)[key] ?? "";

        if (!raw.trim()) {
            // No custom sound set for this key — pass through to Discord
            return soundModule?.playSound?.(name, volume);
        }

        // Play custom sound; fall back to Discord's default if playback fails
        playCustomSound(key).then(played => {
            if (!played) soundModule?.playSound?.(name, volume);
        });
    },

    stop() {
        // Silence everything on plugin disable
        for (const audio of Object.values(audioInstances)) {
            audio?.pause();
        }
    },
});
