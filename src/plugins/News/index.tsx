/*
 * RMS, a Discord client mod
 * Copyright (c) 2026 zxkuhl and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { NotesIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Forms, React, useEffect, useState } from "@webpack/common";

const { FormTitle, FormText } = Forms;

const NEWS_URL = "https://raw.githubusercontent.com/zxkuhl/RMS/main/news.json";
const SEEN_KEY = "rms-seen-news";

interface NewsItem {
    id: string;
    type: "announcement" | "update" | "info" | "warning";
    title: string;
    body: string;
    image: string | null;
    date: string;
    url: string | null;
    urlLabel: string | null;
}

const TYPE_COLORS: Record<string, string> = {
    announcement: "#5865f2",
    update: "#43b581",
    info: "#4f9eed",
    warning: "#faab1a",
};

const TYPE_LABELS: Record<string, string> = {
    announcement: "📢 Announcement",
    update: "🔄 Update",
    info: "ℹ️ Info",
    warning: "⚠️ Warning",
};

function getSeenIds(): string[] {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"); }
    catch { return []; }
}

function markSeen(ids: string[]) {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...getSeenIds(), ...ids])]));
}

function NewsCard({ item }: { item: NewsItem; }) {
    const color = TYPE_COLORS[item.type] ?? "#7878a0";
    const label = TYPE_LABELS[item.type] ?? item.type;

    return (
        <div style={{
            background: "var(--background-secondary)",
            border: "1px solid var(--background-modifier-accent)",
            borderLeft: `3px solid ${color}`,
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: 12,
        }}>
            {item.image && (
                <img
                    src={item.image}
                    alt={item.title}
                    style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
                    onError={e => (e.currentTarget.style.display = "none")}
                />
            )}
            <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {label}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: "var(--text-normal)" }}>
                    {item.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: item.url ? 12 : 0 }}>
                    {item.body}
                </div>
                {item.url && item.urlLabel && (
                    <button
                        onClick={() => RMSNative.native.openExternal(item.url!)}
                        style={{
                            padding: "6px 14px", borderRadius: 6, border: "none",
                            cursor: "pointer", fontWeight: 600, fontSize: 13,
                            background: color, color: "#fff", fontFamily: "inherit",
                        }}
                    >
                        {item.urlLabel} ↗
                    </button>
                )}
            </div>
        </div>
    );
}

function NewsTab() {
    const [news, setNews] = useState<NewsItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    function load() {
        setLoading(true);
        setError(null);
        setNews(null);
        fetch(NEWS_URL)
            .then(r => r.json())
            .then(data => { setNews(data.news ?? []); setLoading(false); })
            .catch(() => { setError("Failed to load news. Check your internet connection."); setLoading(false); });
    }

    useEffect(() => { load(); }, []);

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                    <FormTitle tag="h2" style={{ marginBottom: 2 }}>News</FormTitle>
                    <FormText>Latest announcements and updates from RMS.</FormText>
                </div>
                <button
                    onClick={load}
                    style={{
                        padding: "6px 14px", borderRadius: 6, border: "none",
                        cursor: "pointer", fontWeight: 600, fontSize: 13,
                        background: "var(--background-secondary)",
                        color: "var(--text-muted)", fontFamily: "inherit"
                    }}
                >
                    ↻ Refresh
                </button>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--background-modifier-accent)", marginBottom: 20 }} />

            {loading && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 14 }}>
                    Loading news...
                </div>
            )}
            {error && (
                <div style={{ background: "#2d1a1a", border: "1px solid #ed4245", borderRadius: 8, padding: "12px 16px", color: "#ed4245", fontSize: 14 }}>
                    {error}
                </div>
            )}
            {news && news.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 14 }}>
                    No news yet. Check back later!
                </div>
            )}
            {news?.map(item => <NewsCard key={item.id} item={item} />)}
        </div>
    );
}

export default definePlugin({
    name: "News",
    description: "Adds a News tab to RMS Settings showing announcements and updates pulled live from GitHub.",
    authors: [Devs.zxkuhl],

    start() {
        SettingsPlugin.customEntries.push({
            key: "rms_news",
            title: "News",
            Component: NewsTab,
            Icon: NotesIcon,
        });

        fetch(NEWS_URL)
            .then(r => r.json())
            .then(data => {
                const items: NewsItem[] = data.news ?? [];
                const seen = getSeenIds();
                const unseen = items.filter(i => !seen.includes(i.id));

                if (unseen.length > 0) {
                    const latest = unseen[0];
                    showNotification({
                        title: latest.title,
                        body: latest.body,
                        image: latest.image ?? undefined,
                        onClick: latest.url ? () => RMSNative.native.openExternal(latest.url!) : undefined,
                    });
                    markSeen(unseen.map(i => i.id));
                }
            })
            .catch(() => { });
    },

    stop() {
        const idx = SettingsPlugin.customEntries.findIndex(e => e.key === "rms_news");
        if (idx !== -1) SettingsPlugin.customEntries.splice(idx, 1);
    },
});
