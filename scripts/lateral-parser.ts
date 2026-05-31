import * as cheerio from "cheerio";
import type { TalkEvent, TicketLink, Venue } from "../src/types";
import type { EventStub } from "./parser";
import { makeEventId } from "./parser";

const baseUrl = "https://lateral-osaka.com";

export function parseLateralSchedulePage(html: string, venue: Venue, fetchedAt: string): EventStub[] {
  const $ = cheerio.load(html);
  const stubs: EventStub[] = [];
  const seen = new Set<string>();

  $("li").each((_, element) => {
    const item = $(element);
    const href = item.find("a[href*='/schedule/20']").first().attr("href");
    if (!href) {
      return;
    }

    const detailUrl = absoluteUrl(href);
    const dateMatch = detailUrl.match(/\/schedule\/(20\d{2})-(\d{2})-(\d{2})-/);
    if (!dateMatch) {
      return;
    }

    const id = makeEventId(venue.id, detailUrl);
    if (seen.has(id)) {
      return;
    }
    seen.add(id);

    const [, year, month, day] = dateMatch;
    const title = normalizeWhitespace(
      [item.find(".schedule_event_title").first().text(), item.find(".schedule_event_title_sub").first().text()]
        .filter(Boolean)
        .join(" "),
    );
    const appearance = normalizeLines(item.find(".schedule_appearance").first().text());
    const imageUrl = firstLateralImage($, item);

    stubs.push({
      id,
      venueId: venue.id,
      venueName: venue.name,
      sourceUrl: venue.scheduleUrl,
      detailUrl,
      title: title || "タイトル未取得",
      date: `${year}-${month}-${day}`,
      weekday: item.find(".schedule_date_w").first().text().replace(/[[\]]/g, "").trim() || undefined,
      openTime: lateralTime(item, "open"),
      startTime: lateralTime(item, "start"),
      isStreaming: detectStreaming(item.text()),
      performers: extractPerformers(appearance),
      ticketLinks: [],
      description: appearance,
      imageUrl,
      fetchedAt,
    });
  });

  return stubs.sort((a, b) => `${a.date} ${a.startTime ?? ""}`.localeCompare(`${b.date} ${b.startTime ?? ""}`));
}

export function parseLateralDetailPage(html: string, event: EventStub): TalkEvent {
  const $ = cheerio.load(html);
  const bodyText = normalizeLines($("body").text());
  const ticketLinks = collectTicketLinks($);
  const detailTitle = normalizeWhitespace($(".schedule_event_title").first().text() || $("h1").first().text());
  const description = detailDescription($) || event.description;
  const imageUrl = event.imageUrl ?? firstLateralImage($, $("body"));
  const detailStreaming = detectDetailStreaming(bodyText, ticketLinks);

  return {
    ...event,
    title: detailTitle && detailTitle.length < 180 && detailTitle !== "Scheduleスケジュール" ? detailTitle : event.title,
    isStreaming: event.isStreaming ?? detailStreaming,
    ticketLinks,
    description,
    imageUrl,
  };
}

function lateralTime(item: cheerio.Cheerio<any>, kind: "open" | "start") {
  const hour = item.find(`.${kind}_hour`).first().text().trim();
  const minute = item.find(`.${kind}_min`).first().text().trim();
  return hour && minute ? `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}` : undefined;
}

function firstLateralImage($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>) {
  const candidates: string[] = [];
  root.find("img").each((_, element) => {
    const image = $(element);
    const elementCandidates = [
        image.attr("src"),
        image.attr("data-src"),
        image.attr("data-original"),
        image.attr("data-lazy-src"),
        bestSrcSetCandidate(image.attr("srcset")),
        bestSrcSetCandidate(image.attr("data-srcset")),
      ].filter((value): value is string => Boolean(value));
    candidates.push(...elementCandidates);
  });
  root.find("[style*='background']").each((_, element) => {
    const style = $(element).attr("style") ?? "";
    const match = style.match(/url\((['"]?)(.*?)\1\)/i);
    if (match?.[2]) {
      candidates.push(match[2]);
    }
  });
  candidates.unshift($("meta[property='og:image']").attr("content") ?? "");

  const image = candidates.find(isLikelyLateralImage);
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

function isLikelyLateralImage(src: string | undefined) {
  if (!src) {
    return false;
  }
  const lower = src.toLowerCase();
  if (!/\.(jpg|jpeg|png|webp)(\?|#|$)/.test(lower)) {
    return false;
  }
  if (/logo|icon|button|banner|loading|blank|emoji|slider|arrow/.test(lower)) {
    return false;
  }
  return /lateral-osaka\.com|\/wp-content\/|\/uploads?\//.test(lower);
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
    if (/ticket|zaiko|peatix|eplus|pia|livepocket|tiget|予約|チケット|購入|配信/.test(text) && !seen.has(url)) {
      seen.add(url);
      links.push({ label: label.slice(0, 60), url });
    }
  });
  return links;
}

function detailDescription($: cheerio.CheerioAPI) {
  return $("article p, .entry-content p, main p, .schedule_detail p")
    .map((_, element) => normalizeWhitespace($(element).text()))
    .get()
    .filter((text) => text.length > 20)
    .slice(0, 6)
    .join("\n")
    .slice(0, 1600);
}

function extractPerformers(value: string) {
  return value
    .split(/\n|【|】|〖|〗/)
    .map((part) => part.replace(/^(出演|ゲスト|聞き手|MC|司会|進行)/, "").trim())
    .filter((part) => part && !/^(出演|ゲスト|聞き手|MC|司会|進行)$/.test(part))
    .slice(0, 12);
}

function detectStreaming(value: string) {
  if (/配信\s*あり|配信チケット|オンライン配信|ツイキャス|zaiko/i.test(value)) {
    return true;
  }
  if (/配信\s*なし/.test(value)) {
    return false;
  }
  return undefined;
}

function detectDetailStreaming(bodyText: string, ticketLinks: TicketLink[]) {
  const linkText = ticketLinks.map((ticket) => `${ticket.label} ${ticket.url}`).join(" ");
  return detectStreaming(`${bodyText} ${linkText}`);
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
