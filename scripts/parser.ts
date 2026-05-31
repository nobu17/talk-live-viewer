import * as cheerio from "cheerio";
import type { TalkEvent, TicketLink, Venue } from "../src/types";

const baseUrl = "https://www.loft-prj.co.jp";

export type EventStub = Pick<
  TalkEvent,
  | "id"
  | "venueId"
  | "venueName"
  | "sourceUrl"
  | "detailUrl"
  | "title"
  | "date"
  | "weekday"
  | "openTime"
  | "startTime"
  | "isStreaming"
  | "performers"
  | "ticketLinks"
  | "priceText"
  | "description"
  | "imageUrl"
  | "fetchedAt"
>;

export function parseSchedulePage(html: string, venue: Venue, fetchedAt: string): EventStub[] {
  const $ = cheerio.load(html);
  const stubs: EventStub[] = [];
  const seen = new Set<string>();

  $("a").each((_, element) => {
    const href = $(element).attr("href");
    const rawText = normalizeWhitespace($(element).text());
    const dateMatch = rawText.match(/\b(20\d{2})\s+(\d{1,2})\s+(\d{1,2})\s+([A-Za-z]+)\b/);
    if (!href || !dateMatch || !rawText.includes("START")) {
      return;
    }

    const detailUrl = absoluteUrl(href);
    const id = makeEventId(venue.id, detailUrl);
    if (seen.has(id)) {
      return;
    }
    seen.add(id);

    const [, year, month, day, weekday] = dateMatch;
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const openTime = rawText.match(/OPEN\s+(\d{1,2}:\d{2})/)?.[1];
    const startTime = rawText.match(/START\s+(\d{1,2}:\d{2})/)?.[1];
    const isStreaming = detectStreaming(rawText);
    const titleAndPeople = rawText
      .replace(dateMatch[0], "")
      .replace(/DAY EVENT|MIDNIGHT EVENT|配信\s*(あり|なし)/g, "")
      .replace(/OPEN\s+\d{1,2}:\d{2}\s*-\s*START\s+\d{1,2}:\d{2}[^A-Z]*/g, " ")
      .trim();
    const pieces = splitEventText(titleAndPeople);

    stubs.push({
      id,
      venueId: venue.id,
      venueName: venue.name,
      sourceUrl: venue.scheduleUrl,
      detailUrl,
      title: pieces.title,
      date,
      weekday,
      openTime,
      startTime,
      isStreaming,
      performers: pieces.performers,
      ticketLinks: [],
      fetchedAt,
    });
  });

  return stubs.sort((a, b) => `${a.date} ${a.startTime ?? ""}`.localeCompare(`${b.date} ${b.startTime ?? ""}`));
}

export function parseDetailPage(html: string, event: EventStub): TalkEvent {
  const $ = cheerio.load(html);
  const bodyText = normalizeLines($("body").text());
  const ticketLinks = collectTicketLinks($);
  const imageUrl = firstImage($);
  const priceText = extractSectionText(bodyText, ["料金", "チケット", "前売", "予約"]);
  const description = extractDescription($, bodyText);
  const detailTitle = normalizeWhitespace($("h1").first().text());
  const detailStreaming = detectDetailStreaming(bodyText, ticketLinks);

  return {
    ...event,
    title: detailTitle && detailTitle.length < 180 ? detailTitle : event.title,
    isStreaming: event.isStreaming ?? detailStreaming,
    ticketLinks,
    priceText,
    description,
    imageUrl,
  };
}

export function mergeDuplicateEvents(events: TalkEvent[]) {
  const merged = new Map<string, TalkEvent>();
  for (const event of events) {
    const existing = merged.get(event.id);
    if (!existing) {
      merged.set(event.id, event);
      continue;
    }
    merged.set(event.id, {
      ...existing,
      ...event,
      performers: event.performers.length > 0 ? event.performers : existing.performers,
      ticketLinks: event.ticketLinks.length > 0 ? event.ticketLinks : existing.ticketLinks,
    });
  }
  return [...merged.values()];
}

export function makeEventId(venueId: string, detailUrl: string) {
  const url = new URL(detailUrl);
  const leaf = url.pathname.split("/").filter(Boolean).at(-1) ?? detailUrl;
  return `${venueId}-${leaf.replace(/[^\w-]/g, "")}`;
}

function splitEventText(value: string) {
  const chunks = value.split(/\s{2,}| \.\.\. /).map((chunk) => chunk.trim()).filter(Boolean);
  const title = chunks[0] || "タイトル未取得";
  const performers = chunks
    .slice(1)
    .flatMap((chunk) => chunk.split(/\s{2,}| \/ |、/))
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return { title, performers };
}

function collectTicketLinks($: cheerio.CheerioAPI): TicketLink[] {
  const links: TicketLink[] = [];
  const seen = new Set<string>();
  $("a").each((_, element) => {
    const href = $(element).attr("href");
    const label = normalizeWhitespace($(element).text()) || "チケット";
    if (!href) {
      return;
    }
    const url = absoluteUrl(href);
    const text = `${label} ${url}`.toLowerCase();
    const looksTicket = /ticket|zaiko|peatix|eplus|pia|livepocket|tiget|予約|チケット|購入|配信/.test(text);
    if (looksTicket && !seen.has(url)) {
      seen.add(url);
      links.push({ label: label.slice(0, 60), url });
    }
  });
  return links;
}

function firstImage($: cheerio.CheerioAPI) {
  const imageCandidates: string[] = [];
  $("article img, .schedule_detail img, .content img, main img, img").each((_, element) => {
    imageCandidates.push(...imageCandidatesFromElement($, element));
  });

  const candidates = [
    $("meta[property='og:image']").attr("content"),
    $("meta[name='twitter:image']").attr("content"),
    ...imageCandidates,
  ];
  const image = candidates.find(isLikelyEventImage);
  return image ? absoluteUrl(image) : undefined;
}

function imageCandidatesFromElement($: cheerio.CheerioAPI, element: Parameters<cheerio.CheerioAPI>[0]) {
  const image = $(element);
  return [
    image.attr("src"),
    image.attr("data-src"),
    image.attr("data-original"),
    image.attr("data-lazy-src"),
    image.attr("data-large_image"),
    image.attr("data-full-url"),
    bestSrcSetCandidate(image.attr("srcset")),
    bestSrcSetCandidate(image.attr("data-srcset")),
  ].filter(Boolean) as string[];
}

function bestSrcSetCandidate(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  return value
    .split(",")
    .map((part) => {
      const [url, descriptor] = part.trim().split(/\s+/);
      const width = descriptor?.endsWith("w") ? Number(descriptor.slice(0, -1)) : 0;
      return { url, width };
    })
    .filter((candidate) => candidate.url)
    .sort((a, b) => b.width - a.width)[0]?.url;
}

function isLikelyEventImage(src: string | undefined) {
  if (!src) {
    return false;
  }

  const lower = src.toLowerCase();
  if (!/\.(jpg|jpeg|png|webp)(\?|#|$)/.test(lower)) {
    return false;
  }
  if (/hatena|facebook|twitter|x\.com|line|share|bookmark|button|icon|logo|bnr|banner|loading|blank/.test(lower)) {
    return false;
  }
  if (!/loft-prj\.co\.jp|\/wp-content\/|\/uploads?\//.test(lower)) {
    return false;
  }
  if (hasSmallGeneratedSize(lower)) {
    return false;
  }

  return true;
}

function hasSmallGeneratedSize(src: string) {
  const sizeMatch = src.match(/-(\d{2,4})x(\d{2,4})\.(jpg|jpeg|png|webp)(\?|#|$)/);
  if (!sizeMatch) {
    return false;
  }

  const width = Number(sizeMatch[1]);
  const height = Number(sizeMatch[2]);
  return width < 240 || height < 120;
}

function extractSectionText(bodyText: string, labels: string[]) {
  const lines = bodyText.split("\n").map((line) => line.trim()).filter(Boolean);
  const index = lines.findIndex((line) => labels.some((label) => line.includes(label)));
  if (index === -1) {
    return undefined;
  }
  return lines.slice(index, index + 5).join("\n").slice(0, 600);
}

function extractDescription($: cheerio.CheerioAPI, bodyText: string) {
  const paragraphText = $("article p, .schedule_detail p, .entry-content p, main p")
    .map((_, element) => normalizeWhitespace($(element).text()))
    .get()
    .filter((text) => text.length > 20)
    .slice(0, 6)
    .join("\n");
  if (paragraphText) {
    return paragraphText.slice(0, 1600);
  }
  return bodyText.split("\n").filter((line) => line.length > 20).slice(0, 8).join("\n").slice(0, 1600);
}

function detectStreaming(value: string) {
  if (/配信\s*あり/.test(value)) {
    return true;
  }
  if (/配信\s*なし/.test(value)) {
    return false;
  }
  return undefined;
}

function detectDetailStreaming(bodyText: string, ticketLinks: TicketLink[]) {
  const linkText = ticketLinks.map((ticket) => `${ticket.label} ${ticket.url}`).join(" ");
  const text = `${bodyText} ${linkText}`.toLowerCase();
  if (
    /twitcasting|ツイキャス|zaiko|streaming\+|streamingplus|配信チケット|オンライン配信|有料配信|生配信|アーカイブ配信|視聴チケット/.test(
      text,
    )
  ) {
    return true;
  }
  return undefined;
}

function absoluteUrl(value: string) {
  return new URL(value, baseUrl).toString();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLines(value: string) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join("\n");
}
