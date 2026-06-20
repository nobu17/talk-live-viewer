import * as cheerio from "cheerio";
import type { TalkEvent, Venue } from "../src/types";
import type { EventStub } from "./parser";
import { makeEventId } from "./parser";

const baseUrl = "https://www.dommune.com";
const monthNumbers: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function parseDommuneSchedulePage(html: string, venue: Venue, fetchedAt: string): EventStub[] {
  const $ = cheerio.load(html);
  const stubs: EventStub[] = [];
  const seen = new Set<string>();
  const cutoffDate = archiveCutoffDate(fetchedAt);

  $("article.ScheduleTeaser").each((_, element) => {
    const item = $(element);
    const href = item.find("a.ScheduleTeaser__link").first().attr("href");
    if (!href) {
      return;
    }

    const detailUrl = absoluteUrl(href);
    const year = detailUrl.match(/\/streamings\/(20\d{2})\//)?.[1];
    const month = monthNumbers[normalizeWhitespace(item.find(".ScheduleTeaser__month").first().text()).toLowerCase()];
    const day = normalizeWhitespace(item.find(".ScheduleTeaser__day").first().text()).padStart(2, "0");
    if (!year || !month || !day) {
      return;
    }

    const date = `${year}-${month}-${day}`;
    if (date < cutoffDate) {
      return;
    }

    const id = makeEventId(venue.id, detailUrl);
    if (seen.has(id)) {
      return;
    }
    seen.add(id);

    const title = normalizeLines(item.find(".ScheduleTeaser__title").first().text());
    const timeText = normalizeWhitespace(item.find(".ScheduleTeaser__time").first().text());
    const description = title;

    stubs.push({
      id,
      venueId: venue.id,
      venueName: venue.name,
      sourceUrl: venue.scheduleUrl,
      detailUrl,
      title: title || "Untitled DOMMUNE program",
      date,
      weekday: normalizeWhitespace(item.find(".ScheduleTeaser__weekday").first().text()) || undefined,
      openTime: undefined,
      startTime: parseStartTime(timeText),
      isStreaming: true,
      performers: extractPerformers(title),
      ticketLinks: [],
      description,
      imageUrl: firstDommuneImage($, item),
      fetchedAt,
    });
  });

  return stubs.sort((a, b) => `${a.date} ${a.startTime ?? ""}`.localeCompare(`${b.date} ${b.startTime ?? ""}`));
}

export function parseDommuneDetailPage(html: string, event: EventStub): TalkEvent {
  const $ = cheerio.load(html);
  const detailTitle = normalizeLines($("h1").first().text());
  const description = detailDescription($) || event.description;
  const imageUrl = firstDommuneImage($, $("body")) ?? event.imageUrl;

  return {
    ...event,
    title: detailTitle && detailTitle.length < 240 ? detailTitle : event.title,
    isStreaming: true,
    ticketLinks: collectDommuneLinks($),
    description,
    imageUrl,
  };
}

function parseStartTime(value: string) {
  return value.match(/(\d{1,2}:\d{2})/)?.[1];
}

function extractPerformers(value: string) {
  const markers = ["●出演：", "■出演：", "●DJ：", "■DJ：", "●LIVE：", "■LIVE：", "●TALK：", "■TALK："];
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  const performerLines = lines.filter((line) => markers.some((marker) => line.includes(marker)));
  return performerLines
    .flatMap((line) => line.replace(/^[●■]\s*(出演|DJ|LIVE|TALK)：?/, "").split(/[、,／/]| x | X | × /))
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function firstDommuneImage($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>) {
  const candidates: string[] = [
    $("meta[property='og:image']").attr("content") ?? "",
    $("meta[name='twitter:image']").attr("content") ?? "",
  ];

  root.find("img").each((_, element) => {
    const image = $(element);
    candidates.push(
      ...[
        image.attr("data-src"),
        image.attr("src"),
        image.attr("data-original"),
        image.attr("data-lazy-src"),
        bestSrcSetCandidate(image.attr("srcset")),
        bestSrcSetCandidate(image.attr("data-srcset")),
      ].filter((value): value is string => Boolean(value)),
    );
  });

  const image = candidates.find(isLikelyDommuneImage);
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

function isLikelyDommuneImage(src: string | undefined) {
  if (!src) {
    return false;
  }
  const lower = src.toLowerCase();
  if (!/\.(jpg|jpeg|png|webp)(\?|#|$)/.test(lower)) {
    return false;
  }
  if (/loading|logo|icon|button|banner|bnr|blank|share/.test(lower)) {
    return false;
  }
  return /dommune\.com|\/streamings\/20\d{2}\/images\//.test(lower);
}

function detailDescription($: cheerio.CheerioAPI) {
  return $("article p, main p, .StreamingDetail p, .content p, p")
    .map((_, element) => normalizeWhitespace($(element).text()))
    .get()
    .filter((text) => text.length > 20)
    .slice(0, 8)
    .join("\n")
    .slice(0, 1800);
}

function collectDommuneLinks($: cheerio.CheerioAPI) {
  return $("a[href]")
    .map((_, element) => {
      const href = $(element).attr("href");
      const label = normalizeWhitespace($(element).text()) || "DOMMUNE";
      return href ? { label: label.slice(0, 60), url: absoluteUrl(href) } : undefined;
    })
    .get()
    .filter((link, index, links) => links.findIndex((candidate) => candidate.url === link.url) === index)
    .slice(0, 12);
}

function archiveCutoffDate(reference: string) {
  const today = tokyoDate(reference);
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
  return [
    String(cutoff.getFullYear()),
    String(cutoff.getMonth() + 1).padStart(2, "0"),
    String(cutoff.getDate()).padStart(2, "0"),
  ].join("-");
}

function tokyoDate(reference: string) {
  const date = new Date(reference);
  const source = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(source);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(year, month - 1, day);
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
