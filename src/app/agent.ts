import { OpenAI } from "openai";
import { OPENAI_API_KEY } from "../env";
import { buildSystemInstructions, type IAgentProfile } from "./instructions";
import type { Orchestrator } from "./orchestrator";
import type { MemoryContext, MemoryStore } from "../memory/store";

export interface ITool {
    name: string;
    description: string;
    doc?: string;
    executor: (input: string) => Promise<string>;
}

interface AgentStep {
    step: string;
    text?: string;
    functionName?: string;
    functionInput?: string;
    agentId?: string;
}

export type Interceptor = (message: IMessage) => Promise<IMessage>;

export class AgentBuilder {
    public id?: string;
    public instructions: string | undefined;
    public toolList: ITool[] = [];
    public interceptors: Interceptor[] = [];
    public handoffProfiles: IAgentProfile[] = [];
    public memoryStore?: MemoryStore;
    public memoryContext: MemoryContext = {};

    public setId(id: string) {
        this.id = id;
        return this;
    }

    public setInstructions(instructions: string) {
        this.instructions = instructions;
        return this;
    }

    public tool(tool: ITool) {
        this.toolList.push(tool);
        return this;
    }

    public interceptor(interceptor: Interceptor) {
        this.interceptors.push(interceptor);
        return this;
    }

    public attachInterceptors(...interceptors: Interceptor[]) {
        this.interceptors.push(...interceptors);
        return this;
    }

    public handoff(...profiles: IAgentProfile[]) {
        this.handoffProfiles = profiles;
        return this;
    }

    public memory(store: MemoryStore, context: MemoryContext = {}) {
        this.memoryStore = store;
        this.memoryContext = context;
        return this;
    }

    public build() {
        return new Agent(this);
    }
}

export interface IMessage {
    role: "user" | "assistant" | "developer";
    content: string;
}

export class Agent {
    public readonly id: string;
    private userInstructions: string;
    private instructions: string;
    private toolMap: Map<string, ITool> = new Map();
    private readonly MAX_LOOPS_ALLOWED = 30;
    private openai: OpenAI;
    private messageHistory: IMessage[] = [];
    private interceptors: Interceptor[] = [];
    private handoffProfiles: IAgentProfile[] = [];
    private orchestrator?: Orchestrator;
    private memoryStore?: MemoryStore;
    private memoryContext: MemoryContext = {};
    private runInput = "";

    constructor(builder: AgentBuilder) {
        this.id = builder.id ?? crypto.randomUUID();
        this.interceptors = [...builder.interceptors];
        this.handoffProfiles = [...builder.handoffProfiles];
        this.memoryStore = builder.memoryStore;
        this.memoryContext = { ...builder.memoryContext, agentId: builder.id ?? builder.memoryContext.agentId };
        this.userInstructions = builder.instructions ?? "";
        this.toolMap = new Map();

        for (const tool of builder.toolList) {
            this.toolMap.set(tool.name, tool);
        }

        this.instructions = this.composeInstructions(builder.toolList);
        this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    }

    static builder() {
        return new AgentBuilder();
    }

    bindOrchestrator(orchestrator: Orchestrator, _id: string): void {
        this.orchestrator = orchestrator;
    }

    setHandoffProfiles(profiles: IAgentProfile[]): void {
        this.handoffProfiles = profiles;
        this.instructions = this.composeInstructions([...this.toolMap.values()]);
    }

    public attachInterceptor(interceptor: Interceptor): this {
        this.interceptors.push(interceptor);
        return this;
    }

    public attachInterceptors(...interceptors: Interceptor[]): this {
        this.interceptors.push(...interceptors);
        return this;
    }

    private composeInstructions(tools: ITool[], memoryBlock = ""): string {
        return `${buildSystemInstructions(this.userInstructions, tools, this.handoffProfiles)}${memoryBlock}`;
    }

    private async loadMemoryContext(query: string): Promise<string> {
        if (!this.memoryStore) return "";
        const memories = await this.memoryStore.recall(query, {
            ...this.memoryContext,
            agentId: this.id,
        });
        return this.memoryStore.formatForPrompt(memories);
    }

    private async persistMemory(finalAnswer: string): Promise<void> {
        if (!this.memoryStore || !this.runInput) return;
        await this.memoryStore.remember(
            [
                { role: "user", content: this.runInput },
                { role: "assistant", content: finalAnswer },
            ],
            { ...this.memoryContext, agentId: this.id },
        );
    }

    private async notifyInterceptors(message: IMessage): Promise<IMessage> {
        let current = message;
        for (const interceptor of this.interceptors) {
            current = await interceptor(current);
        }
        return current;
    }

    private async pushMessage(message: IMessage): Promise<void> {
        this.messageHistory.push(await this.notifyInterceptors(message));
    }

    public async run(input: string): Promise<IMessage[]> {
        this.runInput = input;
        this.messageHistory = [];

        const memoryBlock = await this.loadMemoryContext(input);
        this.instructions = this.composeInstructions([...this.toolMap.values()], memoryBlock);

        await this.pushMessage({ role: "user", content: input });

        for (let i = 0; i < this.MAX_LOOPS_ALLOWED; i++) {
            const llmResponse = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: this.instructions },
                    ...this.messageHistory.map(m => ({ role: m.role, content: m.content })),
                ],
            });

            const rawLLMResponse = llmResponse.choices[0]?.message.content;
            if (!rawLLMResponse) {
                throw new Error("LLM returned an empty response");
            }

            let parsedResult: AgentStep;
            try {
                parsedResult = JSON.parse(rawLLMResponse) as AgentStep;
            } catch {
                await this.pushMessage({ role: "assistant", content: rawLLMResponse });
                continue;
            }

            const step = parsedResult.step?.toLowerCase();

            if (step === "output") {
                const finalAnswer = parsedResult.text ?? rawLLMResponse;
                await this.pushMessage({
                    role: "assistant",
                    content: finalAnswer,
                });
                await this.persistMemory(finalAnswer);
                return this.messageHistory;
            }

            if (step === "tool_request") {
                const { functionName, functionInput } = parsedResult;
                const tool = functionName ? this.toolMap.get(functionName) : undefined;

                if (!tool) {
                    await this.pushMessage({
                        role: "assistant",
                        content: `Error: Tool ${functionName ?? "unknown"} not found. Check available tools and try again.`,
                    });
                    continue;
                }

                const toolResult = await tool.executor(functionInput ?? "");
                await this.pushMessage({ role: "assistant", content: toolResult });
                continue;
            }

            if (step === "agent_handoff") {
                const targetId = parsedResult.agentId;
                const handoffMessage = parsedResult.text ?? parsedResult.functionInput ?? "";

                if (!targetId) {
                    await this.pushMessage({
                        role: "assistant",
                        content: "Error: AGENT_HANDOFF requires agentId",
                    });
                    continue;
                }

                if (!this.orchestrator) {
                    await this.pushMessage({
                        role: "assistant",
                        content: "Error: no orchestrator configured for handoff",
                    });
                    continue;
                }

                const handoffResult = await this.orchestrator.handoff(this.id, targetId, handoffMessage);
                await this.pushMessage({ role: "developer", content: handoffResult });
                continue;
            }

            await this.pushMessage({
                role: "assistant",
                content: parsedResult.text ?? rawLLMResponse,
            });
        }

        return this.messageHistory;
    }
}

export type { IAgentProfile } from "./instructions";
