import "./env";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Agent, type Interceptor } from "./app/agent";
import { defaultTools } from "./tools";

const logInterceptor: Interceptor = async (message) => {
    console.log(`\n[${message.role}] ${message.content}\n`);
    return message;
};

function createAgent() {
    const builder = Agent.builder()
        .setInstructions(`You are a capable general-purpose assistant with access to live APIs and a CLI.
Use tools whenever you need real-world data instead of guessing.
For weather, always call fetchWeatherInfo.
For shell tasks, use runCliCommand carefully.
Summarize tool results clearly in the final OUTPUT step.`)
        .attachInterceptors(logInterceptor);

    for (const tool of defaultTools) {
        builder.tool(tool);
    }

    return builder.build();
}

async function runPrompt(agent: Agent, prompt: string) {
    const result = await agent.run(prompt);
    const last = result.at(-1);
    if (last?.role === "assistant") {
        console.log("\n--- Final answer ---");
        console.log(last.content);
    }
}

async function runInteractive(agent: Agent) {
    const rl = readline.createInterface({ input, output });
    console.log("Agent CLI ready. Type a prompt, or 'exit' to quit.\n");

    while (true) {
        const prompt = (await rl.question("you> ")).trim();
        if (!prompt || prompt.toLowerCase() === "exit") break;
        await runPrompt(agent, prompt);
    }

    rl.close();
}

async function main() {
    const agent = createAgent();
    const args = process.argv.slice(2);

    if (args.length > 0) {
        await runPrompt(agent, args.join(" "));
        return;
    }

    await runInteractive(agent);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
