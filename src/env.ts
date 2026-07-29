const requireEnv = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing ${name}. Add it to your .env file.`);
    }
    return value;
};

const optionalEnv = (name: string): string | undefined => process.env[name]?.trim() || undefined;

export const OPENAI_API_KEY = requireEnv("OPENAI_API_KEY");
export const MEM0_API_KEY = optionalEnv("MEM0_API_KEY");
export const MEM0_USER_ID = optionalEnv("MEM0_USER_ID") ?? "default-user";
