import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, text, model_id, parameters } = body;

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "ElevenLabs API key not configured. Please add it to your .env.local file." },
                { status: 500 }
            );
        }

        // Call the ElevenLabs Music endpoint POST /v1/music
        // This endpoint supports up to 5 minute generations based on the prompt
        let response = await fetch("https://api.elevenlabs.io/v1/music", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "xi-api-key": apiKey,
            },
            body: JSON.stringify({
                prompt: prompt + (text ? `\n\nLyrics: ${text}` : ""),
                music_length_ms: parameters?.duration_ms || 120000, // Default 120s / 2m
                force_instrumental: parameters?.force_instrumental || false
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("ElevenLabs API Error details:", errorText);

            let parsedErrorMessage = errorText;
            try {
                const parsed = JSON.parse(errorText);
                parsedErrorMessage = parsed.detail?.message || parsed.detail || errorText;
            } catch (e) { }

            return NextResponse.json(
                { error: `ElevenLabs API Error: ${parsedErrorMessage}` },
                { status: response.status }
            );
        }

        // Get the audio array buffer
        const arrayBuffer = await response.arrayBuffer();

        // Return it as an audio blob stream
        return new NextResponse(arrayBuffer, {
            headers: {
                "Content-Type": "audio/mpeg",
                "Content-Disposition": 'attachment; filename="generated-music.mp3"',
            },
        });

    } catch (error: any) {
        console.error("Error generating music:", error);
        return NextResponse.json(
            { error: "Internal server error during music generation." },
            { status: 500 }
        );
    }
}
