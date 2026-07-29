import type { ITool } from "../app/agent";
import { parseToolInput } from "./helpers";

export const currentTimeTool: ITool = {
    name: "getCurrentTime",
    description: "Get the current date and time, optionally for a specific IANA timezone",
    doc: 'getCurrentTime(timezone?: string). Example: "Asia/Kolkata" or {"timezone":"UTC"}',
    async executor(input: string): Promise<string> {
        const parsed = parseToolInput(input);
        const timezone = typeof parsed === "string" && parsed
            ? parsed
            : parsed && typeof parsed === "object" && "timezone" in parsed
                ? String((parsed as { timezone: unknown }).timezone)
                : Intl.DateTimeFormat().resolvedOptions().timeZone;

        try {
            const now = new Date();
            const formatted = new Intl.DateTimeFormat("en-US", {
                timeZone: timezone,
                dateStyle: "full",
                timeStyle: "long",
            }).format(now);

            return JSON.stringify({
                timezone,
                iso: now.toISOString(),
                formatted,
            });
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : "Invalid timezone",
                timezone,
            });
        }
    },
};

export const uuidTool: ITool = {
    name: "generateUuid",
    description: "Generate a random UUID v4",
    doc: "generateUuid(). Input can be empty.",
    async executor(): Promise<string> {
        return JSON.stringify({ uuid: crypto.randomUUID() });
    },
};
