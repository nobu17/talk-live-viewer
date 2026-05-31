import * as cheerio from "cheerio";
import type { TalkEvent, TicketLink, Venue } from "../src/types";
import type { EventStub } from "./parser";
import { makeEventId } from "./parser";

const baseUrl = "https://bookandbeer.com";

export function parseBookAndBeerSchedulePage(html: string, venue: Venue, fetchedAt: string): EventStub[] {
  const $ = cheerio.load(html);
  const stubs: EventStub[] = [];
  const seen = new Set<string>();

  $("article.article-archive-detail").each((_, element) => {
    const item = $(element);
    const href = item.find("a[href*='/event/']").first().attr("href");
    const dateText = normalizeWhitespace(item.find(".span-strong").first().text());
    const dateMatch = dateText.match(/(20\d{2})\/(\d{2})\/(\d{2})\s+([A-Za-z]+)/);
    if (!href || !dateMatch) {
      return;
    }

    const detailUrl = absoluteUrl(href);
    const id = makeEventId(venue.id, detailUrl);
    if (seen.has(id)) {
      return;
    }
    seen.add(id);

    const [, year, month, day, weekday] = dateMatch;
    const title = normalizeLines(item.find(".detail-span").eq(1).text());
    const timeText = normalizeWhitespace(
      item
        .find("p")
        .filter((_, paragraph) => $(paragraph).text().includes("時間"))
        .first()
        .text(),
    );
    const participationText = normalizeWhitespace(
      item
        .find("p")
        .filter((_, paragraph) => $(paragraph).text().includes("参加方法"))
        .first()
        .text(),
    );

    stubs.push({
      id,
      venueId: venue.id,
      venueName: venue.name,
      sourceUrl: venue.scheduleUrl,
      detailUrl,
      title: title || "タイトル未取得",
      date: `${year}-${month}-${day}`,
      weekday,
      openTime: undefined,
      startTime: parseStartTime(timeText),
      isStreaming: detectStreaming(participationText),
      performers: extractPerformers(title),
      ticketLinks: [],
      description: [title, timeText, participationText].filter(Boolean).join("\n"),
      fetchedAt,
    });
  });

  return stubs.sort((a, b) => `${a.date} ${a.startTime ?? ""}`.localeCompare(`${b.date} ${b.startTime ?? ""}`));
}

export function parseBookAndBeerDetailPage(html: string, event: EventStub): TalkEvent {
  const $ = cheerio.load(html);
  const bodyText = normalizeLines($("body").text());
  const ticketLinks = collectTicketLinks($);
  const detailTitle = normalizeWhitespace($("h1.entry-title").first().text() || $("h1").first().text());
  const description = detailDescription($) || event.description;
  const imageUrl = firstBookAndBeerImage($) ?? event.imageUrl;
  const detailStreaming = detectStreaming(`${bodyText}\n${ticketLinks.map((ticket) => `${ticket.label} ${ticket.url}`).join("\n")}`);

  return {
    ...event,
    title: detailTitle && detailTitle.length < 220 ? detailTitle : event.title,
    isStreaming: event.isStreaming ?? detailStreaming,
    ticketLinks,
    description,
    imageUrl,
  };
}

function parseStartTime(value: string) {
  const match = value.match(/時間：?\s*(\d{1,2}:\d{2})/);
  return match?.[1];
}

function extractPerformers(value: string) {
  const firstLine = value.split("\n")[0] ?? "";
  return firstLine
    .split(/[×／/、,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function firstBookAndBeerImage($: cheerio.CheerioAPI) {
  const candidates: string[] = [
    $("meta[property='og:image']").attr("content") ?? "",
    $("meta[name='twitter:image']").attr("content") ?? "",
  ];

  $("article img, .entry-content img, main img, img").each((_, element) => {
    const image = $(element);
    candidates.push(
      ...[
        image.attr("src"),
        image.attr("data-src"),
        image.attr("data-original"),
        image.attr("data-lazy-src"),
        bestSrcSetCandidate(image.attr("srcset")),
        bestSrcSetCandidate(image.attr("data-srcset")),
      ].filter((value): value is string => Boolean(value)),
    );
  });

  const image = candidates.find(isLikelyBookAndBeerImage);
  return image ? absoluteUrl(image) : undefined;
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

function isLikelyBookAndBeerImage(src: string | undefined) {
  if (!src) {
    return false;
  }
  const lower = src.toLowerCase();
  if (!/\.(jpg|jpeg|png|webp)(\?|#|$)/.test(lower)) {
    return false;
  }
  if (/logo|icon|button|banner|loading|blank|emoji|avatar|profile/.test(lower)) {
    return false;
  }
  return /bookandbeer\.com|\/wp1\/wp-content\/uploads?\//.test(lower);
}

function collectTicketLinks($: cheerio.CheerioAPI): TicketLink[] {
  const links: TicketLink[] = [];
  const seen = new Set<string>();
  $("a").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }
    const label = normalizeWhitespace($(element).text()) || "チケット";
    const url = absoluteUrl(href);
    const text = `${label} ${url}`.toLowerCase();
    if (/ticket|peatix|zaiko|bookandbeer|予約|チケット|参加|配信|購入/.test(text) && !seen.has(url)) {
      seen.add(url);
      links.push({ label: label.slice(0, 60), url });
    }
  });
  return links;
}

function detailDescription($: cheerio.CheerioAPI) {
  return $("article p, .entry-content p, main p")
    .map((_, element) => normalizeWhitespace($(element).text()))
    .get()
    .filter((text) => text.length > 20)
    .slice(0, 8)
    .join("\n")
    .slice(0, 1800);
}

function detectStreaming(value: string) {
  if (/リアルタイム配信|オンライン配信|配信チケット|アーカイブ配信|視聴|streaming|peatix|ツイキャス|zaiko/i.test(value)) {
    return true;
  }
  if (/現地参加のみ|配信なし/.test(value)) {
    return false;
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
