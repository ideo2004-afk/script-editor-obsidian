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
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;
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
1. Provide exactly ONE short, punchy sentence summarising the scene.
2. The summary MUST be in the same language and script (e.g., Traditional Chinese, English, Japanese) as the provided Scene Content.
3. CRITICAL: If the input is in Traditional Chinese (繁體中文), you must respond in Traditional Chinese. Do NOT use Simplified Chinese (簡體中文).
4. Do not include any other text, intros, explanations, or quotes.
5. CRITICAL: Return PLAIN TEXT ONLY. Do NOT use HTML tags (e.g., <b>, <i>) or Markdown bolding (**).
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
2. Provide an short ONE-sentence summary of the new scene.
3. Provide concise script content (Action/Dialogue) in standard screenplay format.
4. ALL content (Heading, Summary, Script) MUST be in the same language and script as the provided Context.
5. CRITICAL: If the input is in Traditional Chinese (繁體中文), you must respond in Traditional Chinese. Do NOT use Simplified Chinese (簡體中文).
6. CRITICAL: Return PLAIN TEXT ONLY. Do NOT use HTML tags (e.g., <b>, <i>) or Markdown bolding (**). All character names and dialogue must be plain text.

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
1. Provide exactly ONE short, punchy sentence per marked block.
2. The summary MUST be in the same language and script as the block's content.
3. CRITICAL: If the input is in Traditional Chinese (繁體中文), you must respond in Traditional Chinese. Do NOT use Simplified Chinese (簡體中文).
4. CRITICAL: Return PLAIN TEXT ONLY. Do NOT use HTML tags or Markdown bolding.
5. Respond ONLY with a list of summaries in the following format:
BLOCK X: Summary text

Screenplay:
${transcript}`;
        return this.callGemini(prompt);
    }

    /**
     * Specialized prompt for rewriting/generating scene content based on rough notes and context
     */
    async generateRewriteScene(content: string, before: string, after: string): Promise<GeminiResponse> {
        const prompt = `Act as a professional Hollywood screenwriter.
Task: Rewrite the "Current Scene Content" into a full, evocative screenplay scene.
Requirements:
1. Maintain consistency with the provided "Context Before" and "Context After".
2. Expand rough notes into lean, cinematic Action descriptions and natural Dialogue.
3. SHOW, DON'T TELL: Focus only on what can be SEEN or HEARD on screen. Avoid unfilmable descriptions (e.g., internal thoughts, smells, or abstract concepts like "absolute silence").
4. BE EFFICIENT: Avoid filler or "purple prose". Every line should advance the story with professional screenplay brevity.
5. If "Current Scene Content" consists only of a heading, generate a logical new scene that bridges the context.
6. Include a short ONE-sentence summary of the new scene.
7. Provide the rewritten script content (Action/Dialogue) in standard screenplay format.
8. DO NOT include the Scene Heading (e.g., INT. / EXT.) in the "CONTENT" section, as it is already kept by the editor.
9. CRITICAL: Maintain the original language for all character names and dialogue as they appear in the "Context" or "Current Scene Content". 
10. CRITICAL: If the input is in Traditional Chinese (繁體中文), you must respond in Traditional Chinese. Do NOT use Simplified Chinese (簡體中文).
11. CRITICAL: Return PLAIN TEXT ONLY. Do NOT use HTML tags (e.g., <b>, <i>) or Markdown bolding (**). All character names and dialogue must be plain text.
12. Return ONLY the following format (no intros or outros):

SUMMARY: [One sentence summary]
CONTENT:
[The rewritten script content (excluding the heading)]

Context Before:
${before}

Context After:
${after}

Current Scene Content:
${content}`;
        return this.callGemini(prompt);
    }
}
