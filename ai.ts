import { requestUrl, Notice } from 'obsidian';

export interface GeminiResponse {
    text: string;
    error?: string;
}

export class GeminiService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async callGemini(prompt: string): Promise<GeminiResponse> {
        if (!this.apiKey) {
            return { text: "", error: "API Key not set" };
        }

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`;
            const response = await requestUrl({
                url: url,
                method: 'POST',
                contentType: 'application/json',
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = response.json;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (!text) {
                return { text: "", error: "Empty response from AI" };
            }

            return { text };
        } catch (error) {
            console.error("Gemini AI Error:", error);
            return { text: "", error: error.message || "Request failed" };
        }
    }

    /**
     * Specialized prompt for generating a scene summary (Beat)
     */
    async generateSceneSummary(content: string): Promise<GeminiResponse> {
        const prompt = `Act as a professional Hollywood screenwriter and script doctor. 
Sumarize the following scene content into a concise BEAT.
Requirements:
1. Provide exactly ONE concise sentence summarising the scene.
2. The summary MUST be in the same language and script (e.g., Traditional Chinese, English, Japanese) as the provided Scene Content.
3. CRITICAL: If the input is in Traditional Chinese (繁體中文), you must respond in Traditional Chinese. Do NOT use Simplified Chinese (簡體中文).
4. Do not include any other text, intros, explanations, or quotes.
Format: Just the summary text.

Scene Content:
${content}`;
        return this.callGemini(prompt);
    }

    /**
     * Specialized prompt for generating a new scene from context
     */
    async generateNewScene(before: string, after: string): Promise<GeminiResponse> {
        const prompt = `Act as a professional Hollywood screenwriter.
Based on the surrounding scenes (Context Before and After), generate a LOGICAL and EVOCATIVE new scene to fill this gap.
Requirements:
1. Provide a Scene Heading.
2. Provide a concise ONE-sentence summary of the new scene.
3. Provide initial script content (Action/Dialogue) in standard screenplay format.
4. ALL content (Heading, Summary, Script) MUST be in the same language and script as the provided Context.
5. CRITICAL: If the input is in Traditional Chinese (繁體中文), you must respond in Traditional Chinese. Do NOT use Simplified Chinese (簡體中文).

Format your response as:
TITLE: [Heading]
SUMMARY: [Summary text]
CONTENT:
[Initial Script lines]

Context Before:
${before}

Context After:
${after}`;
        return this.callGemini(prompt);
    }

    /**
     * Specialized prompt for bulk processing
     */
    async generateBulkSummaries(transcript: string): Promise<GeminiResponse> {
        const prompt = `Act as a professional Hollywood screenwriter. 
Below is a structured screenplay. 
Some blocks are marked with (REQUEST_SUMMARY_FOR_THIS_BLOCK). 
Please generate a concise ONE-sentence summary for each of those marked blocks.

Requirements:
1. Provide exactly ONE concise sentence per marked block.
2. The summary MUST be in the same language and script as the block's content.
3. CRITICAL: If the input is in Traditional Chinese (繁體中文), you must respond in Traditional Chinese. Do NOT use Simplified Chinese (簡體中文).
4. Respond ONLY with a list of summaries in the following format:
BLOCK X: Summary text

Screenplay:
${transcript}`;
        return this.callGemini(prompt);
    }
}
