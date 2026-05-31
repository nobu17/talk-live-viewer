import type { TalkEvent } from "../types";

const maxCollapsedSummaryLength = 120;

export function getEventSummary(event: TalkEvent) {
  return normalizeSummary(event.description);
}

export function shouldCollapseSummary(summary: string) {
  return summary.length > maxCollapsedSummaryLength || summary.split("\n").length > 3;
}

function normalizeSummary(value: string | undefined) {
  if (!value) {
    return "";
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(料金|チケット|前売|予約|OPEN|START)\b/i.test(line))
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
