import type { ITool } from "../app/agent";
import { parseToolInput, truncateOutput } from "./helpers";

export const fetchUrlTool: ITool = {
    name: "fetchUrl",
    description: "Perform an HTTP GET request and return response metadata and body",
    doc: 'fetchUrl(url: string). Example: "https://api.github.com" or {"url":"https://example.com"}',
    async executor(input: string): Promise<string> {
        const parsed = parseToolInput(input);
        const url = typeof parsed === "string"
            ? parsed
            : parsed && typeof parsed === "object" && "url" in parsed
                ? String((parsed as { url: unknown }).url)
                : "";

        if (!url) {
            return JSON.stringify({ error: "URL is required" });
        }

        try {
            const response = await fetch(url, {
                headers: { "User-Agent": "agent-sdk/1.0" },
            });
            const body = truncateOutput(await response.text(), 6000);

            return JSON.stringify({
                url,
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get("content-type"),
                body,
            });
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : "Fetch failed",
                url,
            });
        }
    },
};
