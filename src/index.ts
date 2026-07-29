import "./env";
import { Agent, type ITool } from "./app/agent";

const weatherTool: ITool = {
    name: "fetchWeatherInfo",
    description: "Fetch the weather information for a given city",
    doc: "fetchWeatherInfo(city: string): WeatherInfo",
    async executor(input: string): Promise<string> {
        return JSON.stringify({
            city: input,
            weather: "sunny",
            temperature: 20,
            humidity: 50,
            windSpeed: 10,
            pressure: 1000,
        });
    },
};

async function main() {
    const agent = Agent.builder()
        .setInstructions("You are an expert weather agent")
        .tool(weatherTool)
        .build();

    const result = await agent.run("Can you tell me weather of delhi!");
    console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
