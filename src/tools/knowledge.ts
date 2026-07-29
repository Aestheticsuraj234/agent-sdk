import type { ITool } from "../app/agent";
import { fetchJson, toolInputString } from "./helpers";

interface WikiSummary {
    title: string;
    extract: string;
    content_urls?: {
        desktop?: { page?: string };
    };
}

export const wikipediaTool: ITool = {
    name: "searchWikipedia",
    description: "Fetch a Wikipedia summary for a topic",
    doc: 'searchWikipedia(query: string). Example: "Python programming" or {"query":"Delhi"}',
    async executor(input: string): Promise<string> {
        const query = toolInputString(input);
        if (!query) {
            return JSON.stringify({ error: "Search query is required" });
        }

        try {
            const summary = await fetchJson<WikiSummary>(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
            );

            return JSON.stringify({
                title: summary.title,
                summary: summary.extract,
                url: summary.content_urls?.desktop?.page ?? null,
                source: "wikipedia.org",
            });
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : "Wikipedia lookup failed",
                query,
            });
        }
    },
};

interface DictionaryEntry {
    word: string;
    phonetic?: string;
    meanings?: Array<{
        partOfSpeech: string;
        definitions: Array<{ definition: string; example?: string }>;
    }>;
}

export const dictionaryTool: ITool = {
    name: "lookupWord",
    description: "Look up dictionary definitions for an English word",
    doc: 'lookupWord(word: string). Example: "agent" or {"word":"weather"}',
    async executor(input: string): Promise<string> {
        let word = toolInputString(input);
        try {
            const parsed = JSON.parse(input) as { word?: string };
            if (parsed.word) word = parsed.word.trim();
        } catch {
            // use parsed string
        }

        if (!word) {
            return JSON.stringify({ error: "Word is required" });
        }

        try {
            const entries = await fetchJson<DictionaryEntry[]>(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
            );

            const entry = entries[0];
            if (!entry) {
                return JSON.stringify({ error: `No definition found for: ${word}` });
            }

            return JSON.stringify({
                word: entry.word,
                phonetic: entry.phonetic ?? null,
                meanings: (entry.meanings ?? []).slice(0, 3).map((meaning) => ({
                    partOfSpeech: meaning.partOfSpeech,
                    definitions: meaning.definitions.slice(0, 2).map((def) => ({
                        definition: def.definition,
                        example: def.example ?? null,
                    })),
                })),
                source: "dictionaryapi.dev",
            });
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : "Dictionary lookup failed",
                word,
            });
        }
    },
};
