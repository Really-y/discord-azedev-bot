import { GoogleGenAI } from "@google/genai";
import { Groq } from "groq-sdk";
import { logger } from "../utils/logger";

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly provider: "gemini" | "groq",
    public readonly originalError: unknown,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

const GEMINI_TIMEOUT_MS = 15_000;
const GROQ_TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT_BASE = [
  "Respond in English language only",
  "Tone: professional, realistic, direct",
  "Avoid motivational clichés, toxic positivity, and generic encouragement",
  "Keep responses concise and substantive",
].join("\n");

const DAILY_QUESTION_PROMPT_SUFFIX = [
  "Generate a discussion question about software development, startups, or technology",
  "The question should spark debate or critical thinking",
  "Do NOT include an answer — only the question",
  "One question only, no preamble",
].join("\n");

let geminiClient: GoogleGenAI | null = null;
let groqClient: Groq | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AIServiceError("GEMINI_API_KEY missing", "gemini", null);
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new AIServiceError("GROQ_API_KEY missing", "groq", null);
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
}

async function tryGemini(prompt: string): Promise<string> {
  const client = getGeminiClient();
  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_BASE,
          temperature: 0.8,
        },
      }),
      GEMINI_TIMEOUT_MS,
    );
    const text = response.text;
    if (!text) throw new Error("Gemini returned empty response");
    return text.trim();
  } catch (error) {
    logger.warn("Gemini failed, attempting retry", {
      error: error instanceof Error ? error.message : String(error),
    });
    const response = await withTimeout(
      client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_BASE,
          temperature: 0.8,
        },
      }),
      GEMINI_TIMEOUT_MS,
    );
    const text = response.text;
    if (!text) throw new Error("Gemini returned empty response on retry");
    return text.trim();
  }
}

async function tryGroq(prompt: string): Promise<string> {
  const client = getGroqClient();
  const response = await withTimeout(
    client.chat.completions.create({
      model: "llama-3-8b-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT_BASE },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 256,
    }),
    GROQ_TIMEOUT_MS,
  );
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text.trim();
}

async function generate(prompt: string): Promise<string | null> {
  try {
    return await tryGemini(prompt);
  } catch (geminiError) {
    logger.warn("Gemini failed, falling back to Groq", {
      error: geminiError instanceof Error ? geminiError.message : String(geminiError),
    });
    try {
      return await tryGroq(prompt);
    } catch (groqError) {
      logger.error("Both AI providers failed", {
        gemini: geminiError instanceof Error ? geminiError.message : String(geminiError),
        groq: groqError instanceof Error ? groqError.message : String(groqError),
      });
      return null;
    }
  }
}

export async function generateDailyQuestion(topic?: string): Promise<string | null> {
  const prompt = topic
    ? `${DAILY_QUESTION_PROMPT_SUFFIX}\nTopic: ${topic}`
    : DAILY_QUESTION_PROMPT_SUFFIX;
  return generate(prompt);
}
