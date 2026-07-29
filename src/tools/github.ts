import type { ITool } from "../app/agent";
import { fetchJson, toolInputString } from "./helpers";

interface GitHubRepo {
    full_name: string;
    description: string | null;
    html_url: string;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    language: string | null;
    default_branch: string;
    updated_at: string;
}

export const githubRepoTool: ITool = {
    name: "fetchGitHubRepo",
    description: "Fetch public GitHub repository metadata",
    doc: 'fetchGitHubRepo(repo: string). Example: "facebook/react" or {"repo":"oven-sh/bun"}',
    async executor(input: string): Promise<string> {
        let repo = toolInputString(input);
        try {
            const parsed = JSON.parse(input) as { repo?: string };
            if (parsed.repo) repo = parsed.repo.trim();
        } catch {
            // use raw string
        }

        if (!repo.includes("/")) {
            return JSON.stringify({ error: 'Repo must be in "owner/name" format' });
        }

        try {
            const data = await fetchJson<GitHubRepo>(
                `https://api.github.com/repos/${repo}`,
                { headers: { "User-Agent": "agent-sdk", Accept: "application/vnd.github+json" } },
            );

            return JSON.stringify({
                fullName: data.full_name,
                description: data.description,
                url: data.html_url,
                stars: data.stargazers_count,
                forks: data.forks_count,
                openIssues: data.open_issues_count,
                language: data.language,
                defaultBranch: data.default_branch,
                updatedAt: data.updated_at,
                source: "api.github.com",
            });
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : "GitHub lookup failed",
                repo,
            });
        }
    },
};
