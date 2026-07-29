import type { ITool } from "../app/agent";
import { fetchJson, parseToolInput } from "./helpers";

interface FrankfurterResponse {
    amount: number;
    base: string;
    date: string;
    rates: Record<string, number>;
}

export const exchangeRateTool: ITool = {
    name: "fetchExchangeRate",
    description: "Get latest currency exchange rate between two ISO currency codes",
    doc: 'fetchExchangeRate(from,to). Example: {"from":"USD","to":"INR"} or "USD/INR"',
    async executor(input: string): Promise<string> {
        let from = "USD";
        let to = "EUR";

        const parsed = parseToolInput(input);
        if (typeof parsed === "string") {
            const [base, quote] = parsed.split(/[/,]/).map((part) => part.trim().toUpperCase());
            if (base) from = base;
            if (quote) to = quote;
        } else if (parsed && typeof parsed === "object") {
            const record = parsed as { from?: string; to?: string };
            if (record.from) from = record.from.toUpperCase();
            if (record.to) to = record.to.toUpperCase();
        }

        try {
            const data = await fetchJson<FrankfurterResponse>(
                `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            );

            return JSON.stringify({
                from: data.base,
                to,
                rate: data.rates[to],
                date: data.date,
                source: "frankfurter.app",
            });
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : "Exchange rate lookup failed",
                from,
                to,
            });
        }
    },
};
