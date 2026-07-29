# agent-sdk

A TypeScript agent harness built on [Bun](https://bun.com) and OpenAI. The agent follows a structured **INITIAL → THINK → ANALYSE → OUTPUT** pipeline, can call live APIs and run shell commands via tools, and supports interceptors for logging or transforming messages.

## Features

- **Pipeline-driven reasoning** — the model steps through INITIAL, THINK, ANALYSE, and OUTPUT before returning a final answer
- **Tool calling** — built-in tools for weather, HTTP, finance, geo, knowledge lookups, GitHub, time, UUID, and shell access
- **Live weather** — real forecasts via [Open-Meteo](https://open-meteo.com) (no extra API key)
- **CLI tool** — run host shell commands with safety guardrails
- **Interceptors** — subscribe to every message as it enters history (logging, metrics, transforms)
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
```

Bun loads `.env` automatically on startup. The app validates that `OPENAI_API_KEY` is set before running.

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
├── app/
│   ├── agent.ts      # Agent, AgentBuilder, interceptors
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

The default model is `gpt-4o-mini`, configured in `src/app/agent.ts`.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run start` | Start interactive CLI |
| `bun run cli` | Alias for `start` |

## License

Private project.
