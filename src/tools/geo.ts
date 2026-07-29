import type { ITool } from "../app/agent";
import { fetchJson, toolInputString } from "./helpers";

export const countryLookupTool: ITool = {
    name: "lookupCountry",
    description: "Get country details such as capital, region, population, and currencies",
    doc: 'lookupCountry(name: string). Example: "India" or {"name":"Japan"}',
    async executor(input: string): Promise<string> {
        const name = toolInputString(input);
        if (!name) {
            return JSON.stringify({ error: "Country name is required" });
        }

        try {
            const countries = await fetchJson<Array<{
                name: { common: string };
                capital?: string[];
                region: string;
                subregion?: string;
                population: number;
                currencies?: Record<string, { name: string; symbol: string }>;
                languages?: Record<string, string>;
            }>>(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,capital,region,subregion,population,currencies,languages`);

            const country = countries[0];
            if (!country) {
                return JSON.stringify({ error: `Country not found: ${name}` });
            }

            return JSON.stringify({
                name: country.name.common,
                capital: country.capital?.[0] ?? null,
                region: country.region,
                subregion: country.subregion ?? null,
                population: country.population,
                currencies: country.currencies ?? {},
                languages: country.languages ?? {},
                source: "restcountries.com",
            });
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : "Country lookup failed",
                name,
            });
        }
    },
};

interface IpApiResponse {
    status: string;
    message?: string;
    country?: string;
    regionName?: string;
    city?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
    isp?: string;
    query?: string;
}

export const ipLookupTool: ITool = {
    name: "lookupIp",
    description: "Get geolocation and ISP details for an IP address",
    doc: 'lookupIp(ip: string). Example: "8.8.8.8" or {"ip":"1.1.1.1"}',
    async executor(input: string): Promise<string> {
        const ip = toolInputString(input);
        if (!ip) {
            return JSON.stringify({ error: "IP address is required" });
        }

        try {
            const data = await fetchJson<IpApiResponse>(
                `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,lat,lon,timezone,isp,query`,
            );

            if (data.status !== "success") {
                return JSON.stringify({ error: data.message ?? "IP lookup failed", ip });
            }

            return JSON.stringify({
                ip: data.query,
                country: data.country,
                region: data.regionName,
                city: data.city,
                latitude: data.lat,
                longitude: data.lon,
                timezone: data.timezone,
                isp: data.isp,
                source: "ip-api.com",
            });
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : "IP lookup failed",
                ip,
            });
        }
    },
};
