import { HARNESS_PROMPT } from "./config";

export interface IAgentProfile {
    id: string;
    name: string;
    description: string;
}

export function buildHandoffPrompt(profiles: IAgentProfile[]): string {
    if (profiles.length === 0) return "";

    return `
        Available Agents (for handoff):
        ${profiles.map(p => JSON.stringify({
            agentId: p.id,
            agentName: p.name,
            agentDescription: p.description,
        })).join("\n")}

        Agent Handoff Format:
        { "step": "AGENT_HANDOFF", "agentId": "<target agent id>", "text": "<context or question for the other agent>" }
        Use AGENT_HANDOFF when another agent is better suited. After handoff, you will receive their response and can continue.`;
}

export function buildSystemInstructions(
    userInstructions: string,
    tools: Array<{ name: string; description: string; doc?: string }>,
    handoffProfiles: IAgentProfile[],
): string {
    const toolsSection = tools.length > 0
        ? `Available Tools:\n${tools.map(t => JSON.stringify({
            functionName: t.name,
            functionDescription: t.description,
            functionDoc: t.doc ?? "",
        })).join("\n")}`
        : "Available Tools: none";

    return `${HARNESS_PROMPT}

        System Prompt:
        ${userInstructions}

        ${toolsSection}
        ${buildHandoffPrompt(handoffProfiles)}`;
}
