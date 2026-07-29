// going to be a builder pattern for creating agents
export class AgentBuilder {
    public instructions: string | undefined;

    constructor() { }

    public setInstructions(instructions: string) {
        this.instructions = instructions;
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

// agent class that will be used to create agents
export class Agent {
    public instructions: string;
    public messageHistory: IMessage[] = [];
    constructor(builder: AgentBuilder) {
        this.instructions = builder.instructions ?? "";
        this.messageHistory = []
    }
    static builder() {
        return new AgentBuilder();
    }

    public async run(input: string) {
        process.stdout.write(input);
    }
}