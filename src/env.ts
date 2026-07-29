const requireEnv = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing ${name}. Add it to your .env file.`);
    }
    return value;
};

export const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");
