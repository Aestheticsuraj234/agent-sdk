import "./env";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Agent, type Interceptor } from "./app/agent";
import { Orchestrator } from "./app/orchestrator";
import { sharedMemoryStore } from "./memory/store";
import { MEM0_USER_ID } from "./env";
import { exchangeRateTool, fetchUrlTool, weatherTool, wikipediaTool } from "./tools";

const logInterceptor: Interceptor = async (message) => {
    const tag = message.role === "developer" ? "handoff" : message.role;
    console.log(`\n[${tag}] ${message.content}\n`);
    return message;
};

function withMemory(builder: ReturnType<typeof Agent.builder>, agentId: string) {
    return builder
        .memory(sharedMemoryStore, { userId: MEM0_USER_ID, agentId })
        .attachInterceptors(logInterceptor);
}

function buildOrchestrator() {
    const orchestrator = new Orchestrator();

    const weatherAgent = withMemory(
        Agent.builder()
            .setId("weather")
            .setInstructions("You specialize in weather. Always use fetchWeatherInfo for live data.")
            .tool(weatherTool),
        "weather",
    ).build();

    const researchAgent = withMemory(
        Agent.builder()
            .setId("research")
            .setInstructions("You specialize in research. Use Wikipedia and web fetch tools.")
            .tool(wikipediaTool)
            .tool(fetchUrlTool),
        "research",
    ).build();

    const financeAgent = withMemory(
        Agent.builder()
            .setId("finance")
            .setInstructions("You specialize in currency and finance queries.")
            .tool(exchangeRateTool),
        "finance",
    ).build();

    const coordinator = withMemory(
        Agent.builder()
            .setId("coordinator")
            .setInstructions(`You are the coordinator. Route work to specialists via AGENT_HANDOFF when needed.
- weather agent: weather questions
- research agent: Wikipedia or general research
- finance agent: exchange rates and currency
Handle simple questions yourself. After a handoff response arrives, summarize for the user in OUTPUT.
Use relevant memories from past conversations when the user refers to earlier context.`),
        "coordinator",
    ).build();

    orchestrator
        .register({ id: "weather", name: "Weather Agent", description: "Live weather lookups", agent: weatherAgent })
        .register({ id: "research", name: "Research Agent", description: "Wikipedia and web research", agent: researchAgent })
        .register({ id: "finance", name: "Finance Agent", description: "Currency exchange rates", agent: financeAgent })
        .register({ id: "coordinator", name: "Coordinator", description: "Routes tasks to specialist agents", agent: coordinator });

    return orchestrator;
}

async function runPrompt(orchestrator: Orchestrator, prompt: string) {
    const result = await orchestrator.run("coordinator", prompt);
    const last = result.at(-1);
    if (last?.role === "assistant") {
        console.log("\n--- Final answer ---");
        console.log(last.content);
    }
}

async function runInteractive(orchestrator: Orchestrator) {
    const rl = readline.createInterface({ input, output });
    console.log("Agent CLI ready (coordinator orchestrates weather/research/finance agents).");
    console.log("Type a prompt, or 'exit' to quit.\n");

    while (true) {
        const prompt = (await rl.question("you> ")).trim();
        if (!prompt || prompt.toLowerCase() === "exit") break;
        await runPrompt(orchestrator, prompt);
    }

    rl.close();
}

async function main() {
    const orchestrator = buildOrchestrator();
    console.log(`Memory store: ${sharedMemoryStore.modeLabel}${sharedMemoryStore.enabled ? "" : " (set MEM0_API_KEY in .env to enable)"}\n`);
    const args = process.argv.slice(2);

    if (args.length > 0) {
        await runPrompt(orchestrator, args.join(" "));
        return;
    }

    await runInteractive(orchestrator);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
