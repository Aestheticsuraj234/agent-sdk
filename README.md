# agent-sdk

A TypeScript agent harness built on [Bun](https://bun.com) and OpenAI. The agent follows a structured **INITIAL → THINK → ANALYSE → OUTPUT** pipeline, can call live APIs and run shell commands via tools, and supports interceptors for logging or transforming messages.

## Features

- **Pipeline-driven reasoning** — the model steps through INITIAL, THINK, ANALYSE, and OUTPUT before returning a final answer
- **Tool calling** — built-in tools for weather, HTTP, finance, geo, knowledge lookups, GitHub, time, UUID, and shell access
- **Live weather** — real forecasts via [Open-Meteo](https://open-meteo.com) (no extra API key)
- **CLI tool** — run host shell commands with safety guardrails
- **Interceptors** — subscribe to every message as it enters history (logging, metrics, transforms)
- **Long-term memory** — persistent conversation memory via [mem0](https://mem0.ai) (Platform API)
- **Agent handoff** — specialist agents can delegate to each other via `AGENT_HANDOFF` and the `Orchestrator`
- **Interactive CLI** — REPL mode or one-shot prompts from the command line

## Prerequisites

- [Bun](https://bun.com) v1.3+
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Installation

```bash
git clone <repo-url>
cd agent-sdk
bun install
```

## Environment

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-...
MEM0_API_KEY=m0-...          # optional — enables mem0 long-term memory
MEM0_USER_ID=default-user    # optional — scopes memories per user
```

Bun loads `.env` automatically on startup. The app validates that `OPENAI_API_KEY` is set before running.

Get a free mem0 API key at [app.mem0.ai](https://app.mem0.ai). Without `MEM0_API_KEY`, the agent runs normally but memory recall/store is disabled.

## Usage

### Interactive mode

```bash
bun run start
```

```
Agent CLI ready. Type a prompt, or 'exit' to quit.

you> What is the weather in Delhi?
```

### One-shot prompt

```bash
bun run start -- "What is the USD to INR exchange rate today?"
bun run start -- "Look up the Wikipedia summary for TypeScript"
bun run start -- "Run dir and tell me how many files are in this folder"
```

## Built-in tools

| Tool | Description | Input example |
|------|-------------|---------------|
| `fetchWeatherInfo` | Current weather for a city (Open-Meteo) | `"Delhi"` |
| `runCliCommand` | Run a shell command on the host | `"dir"` or `{"command":"git status"}` |
| `fetchUrl` | HTTP GET request | `"https://api.github.com"` |
| `fetchExchangeRate` | Currency exchange rate | `"USD/INR"` or `{"from":"USD","to":"INR"}` |
| `lookupCountry` | Country metadata | `"India"` |
| `lookupIp` | IP geolocation | `"8.8.8.8"` |
| `searchWikipedia` | Wikipedia summary | `"Delhi"` |
| `lookupWord` | English dictionary lookup | `"agent"` |
| `fetchGitHubRepo` | Public repo metadata | `"oven-sh/bun"` |
| `getCurrentTime` | Current time in a timezone | `"Asia/Kolkata"` |
| `generateUuid` | Random UUID v4 | _(empty)_ |

Tool inputs accept a plain string or JSON, depending on the tool.

## How it works

### Agent pipeline

Each LLM turn returns a JSON step:

```json
{ "step": "THINK", "text": "I need live weather data for Delhi." }
```

When external data is needed, the model emits a tool request:

```json
{
  "step": "tool_request",
  "functionName": "fetchWeatherInfo",
  "functionInput": "Delhi"
}
```

The agent executes the tool, appends the result to message history, and continues the pipeline until an `OUTPUT` step is reached.

### Agent handoff

Register multiple agents with an `Orchestrator`. Each agent's system prompt is automatically updated with the list of available agents (via `.handoff()` / orchestrator sync).

When an agent needs a specialist, it emits:

```json
{
  "step": "AGENT_HANDOFF",
  "agentId": "weather",
  "text": "What is the current weather in Delhi?"
}
```

The orchestrator runs the target agent, returns the reply as a `developer` message, and the calling agent continues.

```typescript
import { Agent } from "./app/agent";
import { Orchestrator } from "./app/orchestrator";
import { weatherTool } from "./tools";

const orchestrator = new Orchestrator();

const weatherAgent = Agent.builder()
  .setId("weather")
  .setInstructions("Weather specialist.")
  .tool(weatherTool)
  .build();

const coordinator = Agent.builder()
  .setId("coordinator")
  .setInstructions("Route weather questions to the weather agent via AGENT_HANDOFF.")
  .build();

orchestrator
  .register({ id: "weather", name: "Weather Agent", description: "Live weather", agent: weatherAgent })
  .register({ id: "coordinator", name: "Coordinator", description: "Routes tasks", agent: coordinator });

await orchestrator.run("coordinator", "What's the weather in London?");
```

Handoff depth is capped at 5 to prevent infinite loops.

### Long-term memory (mem0)

Attach a shared `MemoryStore` to any agent. Before each run, relevant memories are retrieved and injected into the system prompt. After a successful `OUTPUT`, the conversation is saved.

```typescript
import { sharedMemoryStore } from "./memory/store";

const agent = Agent.builder()
  .setId("coordinator")
  .memory(sharedMemoryStore, { userId: "alice", agentId: "coordinator" })
  .build();
```

| Method | Description |
|--------|-------------|
| `recall(query, context)` | Search mem0 for relevant past memories |
| `remember(messages, context)` | Store new memories after a completed run |
| `.memory(store, context)` | Attach memory to an agent via the builder |

Memories are scoped by `userId`, `agentId`, and optional `runId`.

### Builder pattern

```typescript
import { Agent } from "./app/agent";
import { weatherTool } from "./tools";

const agent = Agent.builder()
  .setInstructions("You are a helpful assistant.")
  .tool(weatherTool)
  .attachInterceptors(async (message) => {
    console.log(`[${message.role}]`, message.content);
    return message;
  })
  .build();

const history = await agent.run("What's the weather in London?");
```

### Custom tools

Implement the `ITool` interface:

```typescript
import type { ITool } from "./app/agent";

const myTool: ITool = {
  name: "myTool",
  description: "What this tool does",
  doc: "myTool(input: string): string",
  async executor(input: string): Promise<string> {
    return JSON.stringify({ result: input.toUpperCase() });
  },
};
```

Register it on the builder with `.tool(myTool)`.

### Interceptors

Interceptors run on every message before it is stored in history. They receive a message and return a (possibly modified) message:

```typescript
agent.attachInterceptor(async (message) => {
  // log, redact secrets, add metadata, etc.
  return message;
});
```

Use `.attachInterceptors(...)` to register multiple at build time or runtime.

## Project structure

```
src/
├── index.ts          # CLI entry point
├── env.ts            # Environment validation
├── memory/
│   └── store.ts      # mem0 MemoryStore wrapper
├── app/
│   ├── agent.ts      # Agent, AgentBuilder, interceptors
│   ├── orchestrator.ts # Multi-agent registration and handoff
│   ├── instructions.ts # System prompt + handoff context builder
│   └── config.ts     # Harness system prompt
└── tools/
    ├── index.ts      # defaultTools export
    ├── cli.ts        # Shell command tool
    ├── weather.ts    # Open-Meteo weather
    ├── http.ts       # HTTP fetch
    ├── finance.ts    # Exchange rates
    ├── geo.ts        # Country & IP lookup
    ├── knowledge.ts  # Wikipedia & dictionary
    ├── github.ts     # GitHub repo metadata
    ├── time.ts       # Time & UUID utilities
    └── helpers.ts    # Shared parsing/fetch helpers
```

## CLI tool safety

`runCliCommand` is powerful and runs on your machine. Guardrails in place:

- Blocks known destructive patterns (`rm -rf`, `format`, `shutdown`, etc.)
- 15-second timeout per command
- Output truncated to prevent runaway responses

Use with care, especially in production or shared environments.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `MEM0_API_KEY` | No | mem0 Platform API key — enables long-term memory |
| `MEM0_USER_ID` | No | User scope for memories (default: `default-user`) |

The default model is `gpt-4o-mini`, configured in `src/app/agent.ts`.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run start` | Start interactive CLI |
| `bun run cli` | Alias for `start` |

## License

Private project.
