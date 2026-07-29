import { Agent } from "./app/agent";


async function main() {
    const agent: Agent = Agent.builder().setInstructions("You are an expert match agent").build();

    await agent.run("Hello, how are you?");


}