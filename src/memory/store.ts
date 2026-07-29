import MemoryClient from "mem0ai";
import { MEM0_API_KEY, MEM0_USER_ID } from "../env";

export interface MemoryContext {
    userId?: string;
    agentId?: string;
    runId?: string;
}

export interface MemoryMessage {
    role: "user" | "assistant";
    content: string;
}

function buildFilters(context: MemoryContext): Record<string, string> {
    const filters: Record<string, string> = {};
    if (context.userId) filters.user_id = context.userId;
    if (context.agentId) filters.agent_id = context.agentId;
    if (context.runId) filters.run_id = context.runId;
    return filters;
}

export class MemoryStore {
    private readonly client?: MemoryClient;
    readonly enabled: boolean;

    constructor() {
        if (MEM0_API_KEY) {
            this.client = new MemoryClient({ apiKey: MEM0_API_KEY });
            this.enabled = true;
        } else {
            this.enabled = false;
        }
    }

    async recall(query: string, context: MemoryContext = {}, limit = 5): Promise<string[]> {
        if (!this.client) return [];

        const filters = buildFilters({ userId: context.userId ?? MEM0_USER_ID, ...context });
        const result = await this.client.search(query, { filters, topK: limit });

        return (result.results ?? [])
            .map((item) => item.memory ?? item.data?.memory)
            .filter((value): value is string => Boolean(value));
    }

    async remember(messages: MemoryMessage[], context: MemoryContext = {}): Promise<void> {
        if (!this.client || messages.length === 0) return;

        await this.client.add(messages, {
            userId: context.userId ?? MEM0_USER_ID,
            agentId: context.agentId,
            runId: context.runId,
        });
    }

    formatForPrompt(memories: string[]): string {
        if (memories.length === 0) return "";

        return `
        Relevant memories from past conversations:
        ${memories.map((memory, index) => `${index + 1}. ${memory}`).join("\n")}
        Use these memories when helpful. Do not mention the memory system unless asked.`;
    }

    get modeLabel(): string {
        return this.enabled ? "mem0 platform" : "disabled";
    }
}

export const sharedMemoryStore = new MemoryStore();
