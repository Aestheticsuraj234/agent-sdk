import { HARNESS_PROMPT } from "./config";
import { OpenAI } from "openai";
import { OPENAI_API_KEY } from "../env";

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
}

export type Interceptor = (message: IMessage) => Promise<IMessage>;

export class AgentBuilder {
    public instructions: string | undefined;
    public toolList: ITool[] = [];
    public interceptors: Interceptor[] = [];

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

    public build() {
        return new Agent(this);
    }
}

export interface IMessage {
    role: "user" | "assistant" | "developer";
    content: string;
}

export class Agent {
    private instructions: string;
    private toolMap: Map<string, ITool> = new Map();
    private readonly MAX_LOOPS_ALLOWED = 30;
    private openai: OpenAI;
    private messageHistory: IMessage[] = [];
    private interceptors: Interceptor[] = [];

    constructor(builder: AgentBuilder) {
        this.interceptors = [...builder.interceptors];
        this.toolMap = new Map();

        for (const tool of builder.toolList) {
            this.toolMap.set(tool.name, tool);
        }

        this.instructions = `${HARNESS_PROMPT}

        System Prompt:
        ${builder.instructions ?? ""}

        Available Tools:
        ${builder.toolList.map(t => JSON.stringify({
            functionName: t.name,
            functionDescription: t.description,
            functionDoc: t.doc ?? "",
        })).join("\n")}
        `;
        this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    }

    static builder() {
        return new AgentBuilder();
    }

    public attachInterceptor(interceptor: Interceptor): this {
        this.interceptors.push(interceptor);
        return this;
    }

    public attachInterceptors(...interceptors: Interceptor[]): this {
        this.interceptors.push(...interceptors);
        return this;
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
                await this.pushMessage({
                    role: "assistant",
                    content: parsedResult.text ?? rawLLMResponse,
                });
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

            await this.pushMessage({
                role: "assistant",
                content: parsedResult.text ?? rawLLMResponse,
            });
        }

        return this.messageHistory;
    }
}
