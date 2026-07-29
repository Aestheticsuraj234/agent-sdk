import type { ITool } from "../app/agent";
import { cliTool } from "./cli";
import { countryLookupTool, ipLookupTool } from "./geo";
import { githubRepoTool } from "./github";
import { fetchUrlTool } from "./http";
import { exchangeRateTool } from "./finance";
import { dictionaryTool, wikipediaTool } from "./knowledge";
import { currentTimeTool, uuidTool } from "./time";
import { weatherTool } from "./weather";

export const defaultTools: ITool[] = [
    weatherTool,
    cliTool,
    fetchUrlTool,
    exchangeRateTool,
    countryLookupTool,
    ipLookupTool,
    wikipediaTool,
    dictionaryTool,
    githubRepoTool,
    currentTimeTool,
    uuidTool,
];

export {
    cliTool,
    weatherTool,
    fetchUrlTool,
    exchangeRateTool,
    countryLookupTool,
    ipLookupTool,
    wikipediaTool,
    dictionaryTool,
    githubRepoTool,
    currentTimeTool,
    uuidTool,
};
