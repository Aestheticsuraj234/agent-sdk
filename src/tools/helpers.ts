export function parseToolInput(input: string): unknown {
    const trimmed = input.trim();
    if (!trimmed) return "";

    try {
        return JSON.parse(trimmed);
    } catch {
        return trimmed;
    }
}

export function toolInputString(input: string): string {
    const parsed = parseToolInput(input);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object" && "query" in parsed) {
        return String((parsed as { query: unknown }).query);
    }
    return JSON.stringify(parsed);
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${url}`);
    }
    return response.json() as Promise<T>;
}

export function truncateOutput(text: string, maxLength = 8000): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}\n...[truncated ${text.length - maxLength} chars]`;
}
