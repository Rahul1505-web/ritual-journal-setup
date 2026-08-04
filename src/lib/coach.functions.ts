import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const CoachInput = z.object({
  question: z.string().min(1).max(2000),
  tradeSummary: z.string().min(1).max(20000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .default([]),
});

export const askCoach = createServerFn({ method: "POST" })
  .validator((input: unknown) => CoachInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      instructions:
        "You are TradeLog Pro's AI Trade Coach: a blunt, experienced trading mentor. " +
        "Use ONLY the trader's journal data below to give specific, personalised feedback. " +
        "Reference real symbols, emotions, mistake tags and numbers. Be concise (under 220 words), " +
        "use short paragraphs or dash bullets, and always end with one concrete action for the next week.\n\n" +
        `TRADER JOURNAL DATA:\n${data.tradeSummary}`,
      messages: [...data.history, { role: "user" as const, content: data.question }],
    });

    return { text };
  });
