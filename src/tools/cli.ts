import type { ITool } from "../app/agent";
import { truncateOutput } from "./helpers";

const BLOCKED_PATTERNS = [
    /\brm\s+-rf\b/i,
    /\bformat\s+[a-z]:/i,
    /\bdel\s+\/[sfq]/i,
    /\bmkfs\b/i,
    /\bshutdown\b/i,
    /\breboot\b/i,
    /:\(\)\s*\{\s*:\|:&\s*\};:/,
];

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BUFFER = 512_000;

function isBlocked(command: string): boolean {
    return BLOCKED_PATTERNS.some((pattern) => pattern.test(command));
}

export const cliTool: ITool = {
    name: "runCliCommand",
    description: "Run a shell command on the host machine and return stdout/stderr",
    doc: 'runCliCommand(command: string). Example input: "dir" or "ls -la" or {"command":"git status"}',
    async executor(input: string): Promise<string> {
        let command = input.trim();
        try {
            const parsed = JSON.parse(input) as { command?: string };
            if (parsed.command) command = parsed.command.trim();
        } catch {
            // use raw string input
        }

        if (!command) {
            return JSON.stringify({ error: "No command provided" });
        }

        if (isBlocked(command)) {
            return JSON.stringify({ error: "Command blocked for safety", command });
        }

        try {
            const proc = Bun.spawn({
                cmd: [process.platform === "win32" ? "cmd.exe" : "bash", process.platform === "win32" ? "/c" : "-c", command],
                stdout: "pipe",
                stderr: "pipe",
                env: process.env,
            });

            const timeout = setTimeout(() => proc.kill(), DEFAULT_TIMEOUT_MS);
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(proc.stdout).text(),
                new Response(proc.stderr).text(),
                proc.exited,
            ]);
            clearTimeout(timeout);

            return JSON.stringify({
                command,
                exitCode,
                stdout: truncateOutput(stdout, MAX_BUFFER),
                stderr: truncateOutput(stderr, MAX_BUFFER),
            });
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : "CLI execution failed",
                command,
            });
        }
    },
};
