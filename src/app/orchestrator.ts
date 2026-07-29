import type { Agent, IMessage } from "./agent";

export interface IAgentRegistration {
    id: string;
    name: string;
    description: string;
    agent: Agent;
}

const MAX_HANDOFF_DEPTH = 5;

export class Orchestrator {
    private readonly agents = new Map<string, IAgentRegistration>();
    private handoffDepth = 0;

    register(registration: IAgentRegistration): this {
        registration.agent.bindOrchestrator(this, registration.id);
        this.agents.set(registration.id, registration);
        this.syncHandoffs();
        return this;
    }

    getAgent(id: string): Agent | undefined {
        return this.agents.get(id)?.agent;
    }

    listProfiles(): Array<{ id: string; name: string; description: string }> {
        return [...this.agents.values()].map(({ id, name, description }) => ({ id, name, description }));
    }

    async run(entryId: string, input: string): Promise<IMessage[]> {
        const entry = this.agents.get(entryId);
        if (!entry) {
            throw new Error(`Agent not found: ${entryId}`);
        }

        this.handoffDepth = 0;
        return entry.agent.run(input);
    }

    async handoff(fromId: string, toId: string, message: string): Promise<string> {
        if (fromId === toId) {
            return "Error: cannot hand off to the same agent";
        }

        if (this.handoffDepth >= MAX_HANDOFF_DEPTH) {
            return "Error: max handoff depth exceeded";
        }

        const target = this.agents.get(toId);
        if (!target) {
            return `Error: agent "${toId}" not found. Available: ${this.listProfiles().map(p => p.id).join(", ")}`;
        }

        this.handoffDepth++;
        try {
            const history = await target.agent.run(message);
            const reply = history.at(-1)?.content ?? "No response from handoff agent";
            return `[Agent ${toId} (${target.name})] ${reply}`;
        } finally {
            this.handoffDepth--;
        }
    }

    private syncHandoffs(): void {
        const profiles = this.listProfiles();
        for (const { id, agent } of this.agents.values()) {
            agent.setHandoffProfiles(profiles.filter(p => p.id !== id));
        }
    }
}
