import { jsPDF } from "jspdf";

import type { Rule, Trade } from "./trades";
import { byEmotion, byMistake, bySymbol, money, pnl, sortByDate, stats, tradeRR } from "./trades";

export type PerformancePdfOptions = {
  trades: Trade[];
  rules: Rule[];
  /** Raw assistant messages from the AI coach — coaching insights are extracted */
  coachMessages: string[];
  reportTitle?: string | undefined;
  reportSubtitle?: string | undefined;
};

// ─── helpers ────────────────────────────────────────────────────────────────

function sanitizeFileName(title?: string): string {
  const clean = title
    ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    : "tradelog-performance-report";
  return clean + "-" + new Date().toISOString().slice(0, 10) + ".pdf";
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2192\u279C]/g, "->")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/₹/g, "INR ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^###\s+/gm, "")
    .replace(/^##\s+/gm, "")
    .replace(/^#\s+/gm, "")
    .replace(/`/g, "");
}

function extractCoachingInsights(messages: string[]): string[] {
  const lines: string[] = [];
  for (const msg of messages) {
    const cleaned = cleanMarkdown(msg);
    for (const rawLine of cleaned.split("\n").map((l) => l.trim()).filter(Boolean)) {
      if (/^(here is|here'?s|below is|the following|i have|let me|as requested|sure|of course|great|okay|alright)/i.test(rawLine)) continue;
      if (/click.*button|download.*pdf|generate.*pdf|save this report|prepared below/i.test(rawLine)) continue;
      if (rawLine.length < 15) continue;
      lines.push(rawLine);
    }
  }
  return lines;
}

// ─── main export ────────────────────────────────────────────────────────────

export function exportPerformancePdf({
  trades,
  rules,
  coachMessages,
  reportTitle,
  reportSubtitle,
}: PerformancePdfOptions): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = 210;
  const PH = 297;
  const MX = 14;
  const CW = PW - MX * 2;
  const BOTTOM = 20;

  type RGB = [number, number, number];
  const C = {
    navy: [15, 23, 42] as RGB,
    white: [255, 255, 255] as RGB,
    emerald: [16, 185, 129] as RGB,
    emeraldDark: [5, 150, 105] as RGB,
    indigo: [99, 102, 241] as RGB,
    indigoDark: [79, 70, 229] as RGB,
    red: [220, 38, 38] as RGB,
    slate100: [241, 245, 249] as RGB,
    slate200: [226, 232, 240] as RGB,
    slate400: [148, 163, 184] as RGB,
    slate500: [100, 116, 139] as RGB,
    slate700: [51, 65, 85] as RGB,
    slate900: [15, 23, 42] as RGB,
    amber: [217, 119, 6] as RGB,
  };

  let y = 0;

  function renderHeader() {
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PW, 24, "F");
    doc.setFillColor(...C.emerald);
    doc.rect(0, 24, PW, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...C.white);
    doc.text("TRADELOG PRO", MX, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(199, 210, 254);
    doc.text("PERFORMANCE & COACHING REPORT", MX + 42, 13);
    const nowStr = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    doc.setFontSize(8);
    doc.setTextColor(...C.slate400);
    doc.text(nowStr, PW - MX, 13, { align: "right" });
    y = 34;
  }

  function renderFooters() {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(...C.slate200);
      doc.line(MX, PH - 11, PW - MX, PH - 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...C.slate400);
      doc.text("TradeLog Pro · Confidential Performance Assessment", MX, PH - 6);
      doc.text(`Page ${i} of ${total}`, PW - MX, PH - 6, { align: "right" });
    }
  }

  function need(h: number) {
    if (y + h > PH - BOTTOM) { doc.addPage(); renderHeader(); }
  }

  function sectionTitle(title: string, color: RGB = C.indigoDark) {
    need(14);
    doc.setFillColor(...color);
    doc.rect(MX, y, 3, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...color);
    doc.text(title, MX + 5.5, y + 5.8);
    y += 11;
  }

  function card(label: string, value: string, valueColor: RGB, x: number, w: number) {
    doc.setFillColor(...C.slate100);
    doc.setDrawColor(...C.slate200);
    doc.roundedRect(x, y, w, 16, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.slate500);
    doc.text(label, x + 3, y + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...valueColor);
    doc.text(value, x + 3, y + 13);
  }

  function drawTable(
    headers: string[],
    rows: string[][],
    colWidths: number[],
    colorFn?: (row: string[], col: number) => RGB | null,
  ) {
    const rowH = 7;
    const hdrH = 7.5;
    need(hdrH + rowH);

    doc.setFillColor(...C.navy);
    doc.rect(MX, y, CW, hdrH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.white);
    let cx = MX + 2;
    for (let i = 0; i < headers.length; i++) { doc.text(headers[i]!, cx, y + 5.2); cx += colWidths[i]!; }
    y += hdrH;

    rows.forEach((row, ri) => {
      need(rowH);
      doc.setFillColor(...(ri % 2 === 0 ? C.white : C.slate100));
      doc.setDrawColor(...C.slate200);
      doc.rect(MX, y, CW, rowH, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      let cx2 = MX + 2;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c] ?? "";
        const fg = colorFn ? (colorFn(row, c) ?? C.slate900) : C.slate900;
        doc.setTextColor(...fg);
        doc.text(cell, cx2, y + 4.8);
        cx2 += colWidths[c]!;
      }
      y += rowH;
    });
    y += 4;
  }

  // ══════════════════ BUILD REPORT ══════════════════

  renderHeader();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...C.navy);
  doc.text(reportTitle || "Performance & Coaching Audit", MX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.slate500);
  doc.text(
    reportSubtitle ||
      `Generated from your TradeLog Pro journal · ${trades.length} trade${trades.length !== 1 ? "s" : ""} analysed`,
    MX,
    y,
  );
  y += 10;

  if (trades.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...C.slate500);
    doc.text("No trades found in this selection. Add trades and generate again.", MX, y);
    renderFooters();
    doc.save(sanitizeFileName(reportTitle));
    return;
  }

  const s = stats(trades);
  const cardW = (CW - 6) / 4;

  // ── 1. PERFORMANCE SNAPSHOT ──────────────────────────────────────────────
  sectionTitle("1. PERFORMANCE SNAPSHOT", C.indigoDark);

  card("TOTAL TRADES", `${s.count}`, C.navy, MX, cardW);
  card("WIN RATE", `${s.winRate.toFixed(1)}%`, s.winRate >= 50 ? C.emeraldDark : C.red, MX + cardW + 2, cardW);
  card("NET P&L", `${s.total >= 0 ? "+" : ""}${money(s.total)}`, s.total >= 0 ? C.emeraldDark : C.red, MX + (cardW + 2) * 2, cardW);
  card("WIN / LOSS", `${s.wins}W  ${s.losses}L`, C.navy, MX + (cardW + 2) * 3, cardW);
  y += 19;
  card("AVG WIN", money(s.avgWin), C.emeraldDark, MX, cardW);
  card("AVG LOSS", money(s.avgLoss), C.red, MX + cardW + 2, cardW);
  card("AVG R:R", s.rr > 0 ? `1 : ${s.rr.toFixed(2)}` : "1 : 1.00", s.rr >= 1.5 ? C.emeraldDark : C.amber, MX + (cardW + 2) * 2, cardW);
  card("STREAK", `${s.streak} ${s.streakWin ? "Wins" : "Losses"}`, s.streakWin ? C.emeraldDark : C.red, MX + (cardW + 2) * 3, cardW);
  y += 19;
  card("BEST TRADE", money(s.best), C.emeraldDark, MX, cardW);
  card("WORST TRADE", money(s.worst), C.red, MX + cardW + 2, cardW);
  card("RULES SET", `${rules.length}`, C.indigoDark, MX + (cardW + 2) * 2, cardW);
  card("REPORT DATE", new Date().toLocaleDateString(), C.slate700, MX + (cardW + 2) * 3, cardW);
  y += 23;

  // ── 2. TRADING RULES ──────────────────────────────────────────────────────
  if (rules.length > 0) {
    sectionTitle("2. YOUR TRADING RULES", C.indigoDark);
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]; if (!rule) continue;
      need(8);
      doc.setFillColor(...C.indigo);
      doc.circle(MX + 2, y + 2.5, 1.2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...C.slate900);
      const ruleLines = doc.splitTextToSize(`Rule ${i + 1}: ${rule.text}`, CW - 8);
      doc.text(ruleLines, MX + 6, y + 4);
      y += ruleLines.length * 4.8 + 2;
    }
    y += 4;
  }

  // ── 3. MISTAKE & BEHAVIOUR ANALYSIS ──────────────────────────────────────
  sectionTitle("3. MISTAKE & BEHAVIOUR ANALYSIS", C.red);
  const mistakes = byMistake(trades).filter((m) => m.count > 0);
  if (mistakes.length > 0) {
    drawTable(
      ["TAG", "COUNT", "NET P&L", "VERDICT"],
      mistakes.map((m) => {
        const verdict = m.tag === "Good Trade" || m.tag === "Followed Rules" ? "Positive habit" : m.count >= 3 ? "Recurring issue" : "Watch this";
        return [m.tag, `${m.count}x`, `${m.value >= 0 ? "+" : ""}${money(m.value)}`, verdict];
      }),
      [62, 28, 44, CW - 134],
      (row, col) => {
        if (col === 2) return parseFloat(row[2]!.replace(/[^-\d.]/g, "")) >= 0 ? C.emeraldDark : C.red;
        if (col === 3) return row[3] === "Positive habit" ? C.emeraldDark : row[3] === "Recurring issue" ? C.red : C.amber;
        return null;
      },
    );
  }

  // ── 4. EMOTIONAL ANALYSIS ─────────────────────────────────────────────────
  sectionTitle("4. EMOTIONAL ANALYSIS", C.amber);
  const emotions = byEmotion(trades).filter((e) => e.trades > 0);
  if (emotions.length > 0) {
    drawTable(
      ["EMOTION", "TRADES", "NET P&L", "WIN RATE", "ASSESSMENT"],
      emotions.map((e) => {
        const assessment =
          (e.emotion === "Confident" && e.winRate >= 60) ? "Your edge state" :
          (e.emotion === "FOMO" || e.emotion === "Greedy") ? "Costs you money" :
          e.emotion === "Fearful" ? "Review entries" :
          e.winRate >= 50 ? "Neutral" : "Below average";
        return [e.emotion, `${e.trades}`, `${e.value >= 0 ? "+" : ""}${money(e.value)}`, `${e.winRate}%`, assessment];
      }),
      [36, 22, 38, 26, CW - 122],
      (row, col) => {
        if (col === 2) return parseFloat(row[2]!.replace(/[^-\d.]/g, "")) >= 0 ? C.emeraldDark : C.red;
        if (col === 3) { const wr = parseFloat(row[3]!); return wr >= 60 ? C.emeraldDark : wr < 40 ? C.red : null; }
        if (col === 4) return row[4] === "Your edge state" || row[4] === "Neutral" ? C.emeraldDark : row[4] === "Costs you money" || row[4] === "Below average" ? C.red : null;
        return null;
      },
    );
  }

  // ── 5. SYMBOL BREAKDOWN ───────────────────────────────────────────────────
  sectionTitle("5. SYMBOL BREAKDOWN", C.indigoDark);
  const symbols = bySymbol(trades).slice(0, 10);
  if (symbols.length > 0) {
    drawTable(
      ["SYMBOL", "TRADES", "NET P&L", "VERDICT"],
      symbols.map((sym) => [sym.symbol, `${sym.trades}`, `${sym.value >= 0 ? "+" : ""}${money(sym.value)}`, sym.value > 0 ? "Profitable" : sym.value < 0 ? "Losing" : "Break-even"]),
      [50, 28, 48, CW - 126],
      (row, col) => {
        if (col === 2) return parseFloat(row[2]!.replace(/[^-\d.]/g, "")) >= 0 ? C.emeraldDark : C.red;
        if (col === 3) return row[3] === "Profitable" ? C.emeraldDark : row[3] === "Losing" ? C.red : null;
        return null;
      },
    );
  }

  // ── 6. RECENT / AUDITED TRADES LOG ───────────────────────────────────────
  const isScopedRun = trades.length <= 10;
  sectionTitle(
    isScopedRun ? `6. AUDITED EXECUTIONS (${trades.length} TRADE${trades.length !== 1 ? "S" : ""})` : "6. RECENT TRADES LOG",
    C.slate700,
  );
  const recentTrades = sortByDate(trades).reverse().slice(0, 15);
  if (recentTrades.length > 0) {
    drawTable(
      ["DATE", "SYMBOL", "DIR", "ENTRY -> EXIT", "P&L", "R:R", "EMOTION"],
      recentTrades.map((t) => {
        const p = pnl(t);
        let dateStr = "—";
        try {
          dateStr = new Date(t.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        } catch {
          dateStr = String(t.date || "—");
        }
        const levStr = t.leverage && t.leverage > 1 ? ` (${t.leverage}x)` : "";
        const rrVal = tradeRR(t);
        const rrStr = rrVal !== null ? `1 : ${rrVal.toFixed(2)}` : "—";
        const entryExitStr = `${t.entry.toLocaleString()} -> ${t.exit.toLocaleString()}`;
        return [
          dateStr,
          (t.symbol || "—") + levStr,
          t.direction || "BUY",
          entryExitStr,
          `${p >= 0 ? "+" : ""}${money(p)}`,
          rrStr,
          t.emotion || "Neutral",
        ];
      }),
      [18, 30, 14, 44, 30, 20, CW - 156],
      (row, col) => {
        if (col === 4) return parseFloat(row[4]!.replace(/[^-\d.]/g, "")) >= 0 ? C.emeraldDark : C.red;
        if (col === 2) return row[2] === "BUY" ? C.emeraldDark : C.red;
        if (col === 5) return row[5] !== "—" ? C.emeraldDark : C.slate500;
        return null;
      },
    );

    // ── 6.1. TRADE THESIS & JOURNAL NOTES REVIEW ─────────────────────────────
    const tradesWithNotes = recentTrades.filter((t) => t.notes && t.notes.trim().length > 0);
    if (tradesWithNotes.length > 0) {
      y += 4;
      sectionTitle(
        isScopedRun
          ? `6.1. TRADE THESIS & NOTES (${tradesWithNotes.length} TRADE${tradesWithNotes.length !== 1 ? "S" : ""})`
          : "6.1. TRADE THESIS & JOURNAL NOTES",
        C.indigoDark,
      );

      for (let idx = 0; idx < tradesWithNotes.length; idx++) {
        const tr = tradesWithNotes[idx]!;
        const p = pnl(tr);
        const rrVal = tradeRR(tr);
        const rrText = rrVal !== null ? ` · R:R: 1 : ${rrVal.toFixed(2)}` : "";
        const levText = tr.leverage && tr.leverage > 1 ? ` (${tr.leverage}x)` : "";
        const headerTitle = `Trade #${idx + 1}: ${tr.symbol}${levText} [${tr.direction}] · P&L: ${p >= 0 ? "+" : ""}${money(p)}${rrText} · Emotion: ${tr.emotion}`;

        const cleanNotes = cleanMarkdown(tr.notes.trim());
        const noteLines = doc.splitTextToSize(cleanNotes, CW - 12);
        const boxHeight = noteLines.length * 4.2 + 13;

        need(boxHeight + 4);
        doc.setFillColor(...C.slate100);
        doc.setDrawColor(...C.slate200);
        doc.roundedRect(MX, y, CW, boxHeight, 1.5, 1.5, "FD");

        // Left accent bar
        doc.setFillColor(...(p >= 0 ? C.emeraldDark : C.red));
        doc.rect(MX, y, 2.5, boxHeight, "F");

        // Header text
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...C.navy);
        doc.text(headerTitle, MX + 5, y + 4.5);

        // Subheader: Thesis / Plan label
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...C.indigoDark);
        doc.text("TRADE THESIS & PLAN:", MX + 5, y + 8.5);

        // Notes content
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C.slate700);
        doc.text(noteLines, MX + 5, y + 12.5);

        y += boxHeight + 3;
      }
    }
  }

  // ── 7. AI COACH GUIDANCE ──────────────────────────────────────────────────
  if (coachMessages.length > 0) {
    const insights = extractCoachingInsights(coachMessages);
    if (insights.length > 0) {
      sectionTitle("7. AI COACH GUIDANCE & KEY INSIGHTS", C.emeraldDark);
      for (const line of insights) {
        const isBullet = line.startsWith("- ") || line.startsWith("* ") || /^\d+\.\s/.test(line);
        const isAction = /action|next week|this week|commit|hard stop|stop trading|write down|enforce|journal every/i.test(line);
        const text = isBullet ? line.replace(/^[-*]\s|^\d+\.\s/, "") : line;
        const wrapped = doc.splitTextToSize(text, CW - 10);
        need(wrapped.length * 5 + 6);

        if (isAction) {
          const actionWrapped = doc.splitTextToSize(text, CW - 26);
          const boxH = actionWrapped.length * 4.8 + 6;
          need(boxH + 4);
          doc.setFillColor(240, 253, 244);
          doc.setDrawColor(...C.emerald);
          doc.roundedRect(MX, y, CW, boxH, 1.5, 1.5, "FD");
          doc.setFillColor(...C.emerald);
          doc.rect(MX, y, 2.5, boxH, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(...C.emeraldDark);
          doc.text("ACTION:", MX + 5, y + 4.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...C.slate900);
          doc.text(actionWrapped, MX + 22, y + 4.5);
          y += boxH + 3;
        } else if (isBullet) {
          const bulletWrapped = doc.splitTextToSize(text, CW - 10);
          need(bulletWrapped.length * 4.8 + 4);
          doc.setFillColor(...C.emerald);
          doc.circle(MX + 2, y + 2.5, 1, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...C.slate900);
          doc.text(bulletWrapped, MX + 6, y + 3.8);
          y += bulletWrapped.length * 4.8 + 2;
        } else {
          const normWrapped = doc.splitTextToSize(text, CW - 4);
          need(normWrapped.length * 4.8 + 4);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...C.slate700);
          doc.text(normWrapped, MX, y + 3.8);
          y += normWrapped.length * 4.8 + 2;
        }
      }
    }
  }

  // ── Disclaimer ────────────────────────────────────────────────────────────
  need(16);
  y += 4;
  doc.setFillColor(...C.slate100);
  doc.setDrawColor(...C.slate200);
  doc.roundedRect(MX, y, CW, 12, 2, 2, "FD");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...C.slate500);
  doc.text("This report is generated from your personal trading journal for educational purposes only. Not financial advice.", MX + 3, y + 5);
  doc.text("Past performance is not indicative of future results. Trade responsibly.", MX + 3, y + 9.5);

  renderFooters();
  doc.save(sanitizeFileName(reportTitle));
}

// ─── Legacy shim ─────────────────────────────────────────────────────────────
/** @deprecated Use exportPerformancePdf instead */
export type ExportPdfOptions = {
  sessionTitle: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  statsSummary?: { count: number; winRate: number; total: number; wins: number; losses: number };
};
/** @deprecated */
export function exportChatToPdf(_opts: ExportPdfOptions): void {
  console.warn("exportChatToPdf is deprecated. Use exportPerformancePdf instead.");
}


