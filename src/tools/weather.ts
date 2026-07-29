import type { ITool } from "../app/agent";
import { fetchJson, toolInputString } from "./helpers";

interface GeocodeResult {
    results?: Array<{
        name: string;
        country: string;
        latitude: number;
        longitude: number;
        timezone: string;
    }>;
}

interface ForecastResult {
    current: {
        time: string;
        temperature_2m: number;
        relative_humidity_2m: number;
        wind_speed_10m: number;
        weather_code: number;
    };
    current_units: {
        temperature_2m: string;
        relative_humidity_2m: string;
        wind_speed_10m: string;
    };
}

const WEATHER_CODES: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Rain showers",
    95: "Thunderstorm",
};

export const weatherTool: ITool = {
    name: "fetchWeatherInfo",
    description: "Fetch current weather for a city using Open-Meteo (live data)",
    doc: 'fetchWeatherInfo(city: string). Example: "Delhi" or {"city":"London"}',
    async executor(input: string): Promise<string> {
        const city = toolInputString(input);
        if (!city) {
            return JSON.stringify({ error: "City name is required" });
        }

        try {
            const geocode = await fetchJson<GeocodeResult>(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
            );

            const location = geocode.results?.[0];
            if (!location) {
                return JSON.stringify({ error: `City not found: ${city}` });
            }

            const forecast = await fetchJson<ForecastResult>(
                `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`,
            );

            return JSON.stringify({
                city: location.name,
                country: location.country,
                timezone: location.timezone,
                temperature: forecast.current.temperature_2m,
                temperatureUnit: forecast.current_units.temperature_2m,
                humidity: forecast.current.relative_humidity_2m,
                humidityUnit: forecast.current_units.relative_humidity_2m,
                windSpeed: forecast.current.wind_speed_10m,
                windSpeedUnit: forecast.current_units.wind_speed_10m,
                condition: WEATHER_CODES[forecast.current.weather_code] ?? "Unknown",
                observedAt: forecast.current.time,
                source: "open-meteo.com",
            });
        } catch (error) {
            return JSON.stringify({
                error: error instanceof Error ? error.message : "Weather lookup failed",
                city,
            });
        }
    },
};
