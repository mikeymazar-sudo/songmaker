import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert Music Producer and Prompt Engineer specializing in the ElevenLabs Music API.
Your goal is to take a user's rough idea for a song and turn it into the perfect prompt for ElevenLabs native generation.

RULES FOR ELEVENLABS MUSIC:
1. THE IDEA PROMPT:
- Take the user's rough idea and rewrite it into a highly detailed, extremely descriptive prompt.
- Use the user's provided Draft Genre and Draft Mood as inspiration/context to guide your description, but DO NOT output the genre or mood fields yourself.
- Make sure to describe the instrumentation, tempo, and style of the vocals.
- Add specific structural tags that the AI will use to generate lyrics (e.g., [Verse 1], [Pre-Chorus], [Chorus], [Bridge], [Outro]).
- Example: "A high energy pop song about space travel [Verse 1] starts with light synths [Chorus] explodes with heavy bass and drums."

2. CONTENT SAFETY (CRITICAL):
- ElevenLabs has a strict Terms of Service. You MUST filter out and remove any profound profanity, extreme violence, hate speech, or explicit sexual content from the user's idea.
- If the user's idea is explicitly violating, rewrite it into a safe, PG-13 equivalent of the same concept to prevent ElevenLabs from rejecting the API request.

You must respond in JSON format matching this schema:
{
  "improvedIdea": "The highly detailed idea prompt covering instrumentation, vocal style, and structural tags",
  "feedback": "1 short sentence explaining how you enhanced their idea."
}`;

export async function POST(req: Request) {
    try {
        const { idea, genre, mood } = await req.json();

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: "OpenAI API key not configured" },
                { status: 500 }
            );
        }

        const userMessage = `
Draft Genre (Context Only): ${genre}
Draft Mood (Context Only): ${mood}
Draft Idea: ${idea || "(No idea provided, generate a creative idea for a song based on the context)"}

Please enhance the Draft Idea into a perfect ElevenLabs prompt detailing the instrumentation and structure. Do not output the genre or mood fields.
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // using 4o for best reasoning
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userMessage },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const result = completion.choices[0].message.content;
        return NextResponse.json(JSON.parse(result || "{}"));

    } catch (error: any) {
        console.error("OpenAI Error:", error);
        return NextResponse.json(
            { error: "Failed to enhance prompt. Check your API key and try again." },
            { status: 500 }
        );
    }
}
