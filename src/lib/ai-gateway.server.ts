import { createGoogleGenerativeAI } from "@ai-sdk/google";
import dns from "node:dns";

// Force Node.js to prefer IPv4 results from DNS lookups globally.
// This prevents connection timeouts on ISPs where IPv6 routing to Google
// (generativelanguage.googleapis.com) is broken or unreachable.
dns.setDefaultResultOrder("ipv4first");

export function createGeminiProvider() {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return createGoogleGenerativeAI({ apiKey });
}
