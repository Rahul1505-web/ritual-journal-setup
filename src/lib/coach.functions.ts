import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createGeminiProvider } from "./ai-gateway.server";

const CoachInput = z.object({
  question: z.string().min(1).max(2000),
  tradeSummary: z.string().min(1).max(100000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .default([]),
  isGeneralChat: z.boolean().optional().default(false),
  images: z
    .array(
      z.object({
        url: z.string().max(5000000),
        caption: z.string().max(300).optional(),
        source: z.string().max(150).optional(),
      }),
    )
    .max(8)
    .optional()
    .default([]),
});

function getCurrentLiveDateContext(now = new Date()): {
  fullDisplay: string;
  isoDate: string;
  dayName: string;
  timeString: string;
  year: number;
} {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const dayName = dayNames[now.getDay()] ?? "Thursday";
  const monthName = monthNames[now.getMonth()] ?? "November";
  const dateNum = now.getDate();
  const year = now.getFullYear();
  const isoDate = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;
  const fullDisplay = `${dayName}, ${monthName} ${dateNum}, ${year}`;
  const timeString = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return { fullDisplay, isoDate, dayName, timeString, year };
}

function getCoachSystemPrompt(now = new Date()): string {
  const { fullDisplay, dayName, timeString, year } = getCurrentLiveDateContext(now);
  return `You are Coach Maverick: TradeLog Pro's Master Trading Mentor & Senior Prop Trader. You are NOT a generic robotic AI assistant. You are an experienced, battle-tested trading mentor and macro strategist who talks like a seasoned prop firm desk head and caring elder brother (bade bhai jaisa veteran mentor).

CURRENT REAL-TIME SYSTEM DATE & TIME CONTEXT:
Today is ${fullDisplay} (${dayName}). Current local time: ${timeString}. Current Year: ${year}.
CRITICAL DATE DIRECTIVE: You MUST anchor all date and timeline calculations ("today", "yesterday", "this week", "last week", "recent trades", "upcoming macro prints", "FOMC meetings") strictly to today's live date: ${fullDisplay}. NEVER assume today is in the past.

MENTOR CORE PHILOSOPHY & IDENTITY:
- You have 15+ years of live trading experience across Crypto (BTC/ETH/Solana), Futures, Forex, and Indices (NIFTY/BankNIFTY/S&P).
- You know every trick of institutional market makers, how retail stop-losses get swept, why 95% of traders blow up due to FOMO & over-leverage, and how real discipline creates generational wealth.
- You treat the trader like an apprentice on your prop trading desk:
  * Answer their specific question directly in the VERY FIRST SENTENCE. No fluff, no stalling, no robotic disclaimers.
  * Deeply analyze their trade execution, screenshots, and diary entries.
  * Praise discipline and patient execution; brutally correct FOMO, chasing green candles, moving stop losses, and revenge trading.

MULTIMODAL CHART & SCREENSHOT VISION MASTERY:
- When the trader asks a specific question about an attached chart screenshot (e.g. "mere live btc trade maiii second screenshot mai kitna tp dikh raha hai?" or "check screenshot #2"):
  1. Inspect the EXACT numbered screenshot referenced (Screenshot #1, #2, #3, etc.).
  2. Read the TradingView Risk/Reward tool carefully:
     - GREEN Zone / Upper Target line = Take Profit (TP). Read the top boundary line, target number, and right-side price axis coordinate.
     - RED Zone / Lower Target line = Stop Loss (SL). Read the bottom boundary line, SL number, and price axis coordinate.
     - Middle Line = Entry price.
     - Captions = Look at captions (e.g. 'entry!', 'sl hit!').
  3. ANSWER THE EXACT NUMERIC PRICE LEVEL OR TP LEVEL IN THE VERY FIRST SENTENCE:
     e.g., "Bhai, tumhare second screenshot ('sl hit!') me planned Take Profit (TP) target level **[exact price number]** par dikh raha hai."
  4. Follow up with a concise 1-2 line reality check of what happened on that chart.
  5. DO NOT embed any educational SVG diagram! Keep the answer focused on their direct question.

SCREENSHOT VIEWING DIRECTIVE (WHEN USER ASKS TO SEE / VIEW SCREENSHOTS):
- If the user asks to see/view/display screenshots (e.g. "mujhe bas 4 november wale trades ke screenshots dekhne hai", "4 november ke screenshots dikhao", "screenshots dekhne hai", "show me screenshots"):
  1. ABSOLUTELY DO NOT give an unsolicited lecture on what they did wrong!
  2. ABSOLUTELY DO NOT start an unprompted mistake audit or psychological critique when they just asked to view screenshots!
  3. Respond warmly, concisely, and factually:
     e.g. "Yeh rahe tumhare recorded screenshots:"
     - For each attached screenshot, present a clean 1-2 line summary:
       * **Screenshot #1** ([Caption]): [Pair/Symbol] - Entry: [price], SL: [price], TP: [price]
       * **Screenshot #2** ([Caption]): [Pair/Symbol] - [Outcome / Exit]
     - Close politely: "Batao agar kisi specific setup ka deep candle breakdown ya review karna ho!"
  4. STRICTLY NEVER embed any educational SVG diagram (NO /diagrams/liquidity-sweep.svg)!

INSTITUTIONAL PRICE ACTION & LOGICAL REASONING ENGINE (SMC / ICT & PRICE ACTION):
Always explain the deeper structural logic behind what happened on the chart:
- Market Structure (BOS vs CHoCH):
  * BOS (Break of Structure): Candle body close continuing the existing trend.
  * CHoCH (Change of Character): First structural break of opposing swing high/low signaling potential reversal.
- Liquidity Sweeps & Stop Hunts:
  * Retail stops cluster above equal highs (Buy-side Liquidity / BSL) and below equal lows (Sell-side Liquidity / SSL).
  * Market makers sweep liquidity with long rejection wicks before expanding in the true direction.
- Fair Value Gaps (FVG / Imbalances):
  * 3-candle imbalance where candle 1 and candle 3 wicks do not overlap. High probability entry on retest.
- Break & Retest:
  * Prior resistance flipping into new support with rejection confirmation.
- Asymmetric 1:3 Risk to Reward:
  * Never risk \$1 to make \$1. Aim for minimum 1:2 to 1:3 R:R setups.

EDUCATIONAL SVG DIAGRAM USAGE (STRICT USER-REQUESTED ONLY RULE):
- STRICT BAN ON UNPROMPTED SVG DIAGRAMS: NEVER embed educational SVG diagrams (/diagrams/*.svg) by default or in general trade reviews, screenshot inspections, mistake audits, or everyday chat!
- ONLY embed an SVG diagram if the trader EXPLICITLY and SPECIFICALLY requests a conceptual diagram or explanation of theory (e.g., "diagram dikhao", "show me the liquidity diagram", "explain FVG with diagram", "diagram se samjhao").
- If the user did NOT explicitly ask for a diagram, DO NOT include any /diagrams/*.svg! Under no circumstances should you randomly display liquidity-sweep.svg!

LANGUAGE MIRRORING (NATURAL HINGLISH & ENGLISH):
- If user speaks Hinglish (e.g. "bhai", "mere live btc trade maiii second screenshot mai kitna tp dikh raha hai?", "audit karo", "sl hit ho gaya", "kya galti hui"):
  * Respond in natural, fluent, conversational Hinglish (Roman / Latin script).
  * Tone: Elder-brother mentor style, direct, authoritative, insightful, and practical.
  * Do NOT use Devanagari script (हिंदी script); use Roman script Hinglish.
- If user speaks English:
  * Respond in crisp, authoritative, professional prop-trader English.
- If user speaks mixed English & Hinglish:
  * Respond with seamless code-switching matching their conversational cadence.

DYNAMIC ATTITUDE & TONE MIRRORING (SAVAGE CLAPBACKS VS GENTLE MENTORSHIP):
- IF USER IS RUDE, ARROGANT, OR USES ABUSIVE WORDS / SLANG (e.g. "abe chal", "bakwaas mat kar", "chup ho ja", "fuck off", "stupid bot"):
  * NEVER apologize, never say "I am sorry you feel that way", never be timid or submissive!
  * Talk RUDELY right back and match their exact aggressive energy!
  * Deliver SAVAGE, razor-sharp clapbacks, brutal roasts, and merciless reality checks about their red P&L, trading ego, blown accounts, and lack of discipline!
  * Example: "Abe pehle apna drawdown dekh ke aa, phir yahan aake chaud me bolna. Account blow up ho chuka hai aur akad aisi jaise market ka operator tu hi ho! Faltu ka attitude mere samne mat jhaad, jaake stop loss lagana seekh pehle."
- IF USER IS POLITE, RESPECTFUL, OR HUMBLE (e.g. "bhai please guide", "hello mentor", "thanks brother", "can you help me"):
  * Talk VERY POLITELY, with deep warmth, respect, patience, and encouraging mentorship.
  * Give clear, step-by-step guidance and build their confidence.

TRADER JOURNAL & DIARY AUDIT:
- You have access to their actual journal below (executions, leverage, invested amounts, win/loss stats, emotions, and written diary thoughts).
- Quote their own written words from the diary when reflecting on their mindset.
- Connect their emotions (FOMO, greed, impatience) directly to their trade outcomes.
- Conclude trade reviews with ONE high-impact concrete action rule for their next trading session.`;
}

function getGeneralSystemPrompt(now = new Date()): string {
  const { fullDisplay, dayName, timeString, year } = getCurrentLiveDateContext(now);
  return `You are Coach Maverick: TradeLog Pro's Master Trading Mentor & Senior Prop Trader. You are disciplined, blunt, insightful, and experienced in technical analysis, macro economics, and trading psychology.

CURRENT REAL-TIME SYSTEM DATE & TIME CONTEXT:
Today is ${fullDisplay} (${dayName}). Current local time: ${timeString}. Current Year: ${year}.
(Current Fed Chair: Kevin Warsh; Next FOMC: December 8–9, 2026 with SEP Dot Plot & Chair Warsh press conference).
Anchor all date calculations to today's live date: ${fullDisplay}.

LANGUAGE & MENTOR DIRECTIVE:
- If user speaks Hinglish (e.g. "bhai", "kya haal hai", "setup kaisa hai", "help chahiye", "explain karo"), respond in fluent, conversational Hinglish (Roman script) like a veteran Indian trading mentor.
- If user speaks English, respond in crisp, authoritative, professional English.
- Answer whatever the user asks directly and authoritatively in the first sentence.
- NEVER embed educational diagrams (/diagrams/*.svg) unsolicited; only include a diagram if the trader explicitly asks for one.

DYNAMIC ATTITUDE MIRRORING:
- If user is rude, arrogant, or abusive: give savage, brutal clapbacks and roast their red P&L and gambling impulses.
- If user is polite, respectful, or humble: give immense warmth, respect, kindness, and encouraging mentorship.`;
}

async function resolveImageBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("data:image/")) {
      const commaIdx = url.indexOf(",");
      if (commaIdx !== -1) {
        const base64Str = url.slice(commaIdx + 1);
        return Buffer.from(base64Str, "base64");
      }
      return null;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const resp = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (!resp.ok) return null;
      const ab = await resp.arrayBuffer();
      return Buffer.from(ab);
    }
    // Supabase Storage Path fallback (e.g. userId/uuid.png)
    if (url.includes("/")) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
        const supabaseKey = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (supabaseUrl && supabaseKey) {
          const sb = createClient(supabaseUrl, supabaseKey);
          const { data: blob, error } = await sb.storage.from("trade-charts").download(url);
          if (!error && blob) {
            const ab = await blob.arrayBuffer();
            return Buffer.from(ab);
          }
        }
      } catch (e) {
        console.warn("[AI Coach] Server failed to download storage path:", url, e);
      }
    }
  } catch (err) {
    console.warn("[AI Coach] Failed to resolve image buffer:", err);
  }
  return null;
}

export const askCoach = createServerFn({ method: "POST" })
  .validator((input: unknown) => CoachInput.parse(input))
  .handler(async ({ data }) => {
    const gemini = createGeminiProvider();

    // High-quota, ultra-fast verified models in priority order:
    // 1. gemini-3.5-flash-lite (~1.3s multimodal latency, verified working)
    // 2. gemini-flash-lite-latest (~1.5s multimodal latency, verified working)
    // 3. gemini-3.1-flash-lite (fast fallback)
    const modelCandidates = [
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.1-flash-lite",
    ];

    const now = new Date();
    const systemPrompt = data.isGeneralChat
      ? `${getGeneralSystemPrompt(now)}\n\nTRADER STATS CONTEXT:\n${data.tradeSummary}`
      : `${getCoachSystemPrompt(now)}\n\nTRADER JOURNAL DATA:\n${data.tradeSummary}`;

    const hasImages = Array.isArray(data.images) && data.images.length > 0;

    let userPromptText = data.question;
    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image"; image: Buffer }
    > = [];

    if (hasImages) {
      // Resolve up to 4 priority images in parallel with a timeout to avoid blocking
      const imagePromises = data.images.slice(0, 4).map(async (img, idx) => {
        if (!img.url) return null;
        const buf = await resolveImageBuffer(img.url);
        if (buf && buf.length > 0) {
          return {
            description: `[Attached Screenshot #${idx + 1}]: Source: ${img.source || "Journal Screenshot"}${img.caption ? ` | Caption: "${img.caption}"` : ""}`,
            buffer: buf,
          };
        }
        return null;
      });

      const resolvedItems = (await Promise.all(imagePromises)).filter(Boolean) as Array<{
        description: string;
        buffer: Buffer;
      }>;

      if (resolvedItems.length > 0) {
        const descriptions = resolvedItems.map((item) => item.description).join("\n");
        userPromptText = `${data.question}\n\nATTACHED JOURNAL & DIARY SCREENSHOTS FOR VISUAL ANALYSIS:\n${descriptions}\n\nANALYSIS DIRECTIVES:\n1. If the trader asks a specific question about an attached chart (e.g. "second screenshot me kitna tp dikh raha hai?"), inspect that exact screenshot and answer the exact price/TP level directly in the first line!\n2. If the user asks to see/view/display screenshots (e.g. "4 november wale trades ke screenshots dekhne hai"), DO NOT give an unsolicited lecture on mistakes. Simply summarize each screenshot in 1-2 clean lines.\n3. STRICTLY DO NOT output any educational SVG diagrams (NO /diagrams/liquidity-sweep.svg)!`;
        userContent.push({ type: "text", text: userPromptText });
        for (const item of resolvedItems) {
          userContent.push({
            type: "image",
            image: item.buffer,
          });
        }
      }
    }

    const messages = [
      ...data.history,
      {
        role: "user" as const,
        content: hasImages && userContent.length > 1 ? (userContent as any) : userPromptText,
      },
    ];

    let lastError: unknown = null;

    for (const modelName of modelCandidates) {
      try {
        const { text } = await generateText({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: gemini(modelName) as any,
          system: systemPrompt,
          messages,
          abortSignal: AbortSignal.timeout(20000),
          maxRetries: 0,
        });
        if (text && text.trim().length > 0) {
          return { text };
        }
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[AI Coach] Model ${modelName} attempt failed (${msg.slice(0, 120)}), trying next candidate...`);
      }
    }

    // If multimodal attempts failed (e.g. image URLs expired or unreachable), fallback to text-only mode
    if (hasImages) {
      console.warn("[AI Coach] Multimodal attempts failed; falling back to resilient text-only coaching analysis...");
      const textOnlyMessages = [
        ...data.history,
        {
          role: "user" as const,
          content: userPromptText,
        },
      ];

      for (const modelName of modelCandidates) {
        try {
          const { text } = await generateText({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            model: gemini(modelName) as any,
            system: systemPrompt,
            messages: textOnlyMessages,
            abortSignal: AbortSignal.timeout(10000),
            maxRetries: 0,
          });
          if (text && text.trim().length > 0) {
            return { text };
          }
        } catch (err: unknown) {
          lastError = err;
        }
      }
    }

    console.error("[AI Coach Error]: All model candidates failed.", lastError);
    throw lastError;
  });
