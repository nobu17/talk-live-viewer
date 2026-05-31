import * as cheerio from "cheerio";
import type { TalkEvent, TicketLink, Venue } from "../src/types";
import type { EventStub } from "./parser";
import { makeEventId } from "./parser";

const baseUrl = "https://pundit.jp";

export function parsePunditSchedulePage(html: string, venue: Venue, fetchedAt: string): EventStub[] {
  const $ = cheerio.load(html);
  const stubs: EventStub[] = [];
  const seen = new Set<string>();
  const { minDate, maxDate } = relevantDateRange();

  $("li.grid__item, .product-card-wrapper").each((_, element) => {
    const item = $(element);
    const link = item.find("a.full-unstyled-link[href*='/products/']").first();
    const href = link.attr("href");
    if (!href) {
      return;
    }

    const detailUrl = absoluteUrl(href);
    const id = makeEventId(venue.id, detailUrl);
    if (seen.has(id)) {
      return;
    }

    const title = normalizeLines(link.text() || item.find("img[alt]").first().attr("alt") || "");
    const dateParts = parseDateFromTitle(title);
    if (!dateParts || dateParts.date < minDate || dateParts.date > maxDate) {
      return;
    }
    seen.add(id);

    const priceText = normalizeWhitespace(item.find(".price-item--regular, .price-item--sale").first().text());

    stubs.push({
      id,
      venueId: venue.id,
      venueName: venue.name,
      sourceUrl: venue.scheduleUrl,
      detailUrl,
      title: title || "Pundit event",
      date: dateParts.date,
      weekday: dateParts.weekday,
      openTime: undefined,
      startTime: undefined,
      isStreaming: undefined,
      performers: extractPerformers(title),
      ticketLinks: [],
      priceText: priceText || undefined,
      description: title,
      imageUrl: firstPunditImage($, item),
      fetchedAt,
    });
  });

  return stubs.sort((a, b) => `${a.date} ${a.startTime ?? ""}`.localeCompare(`${b.date} ${b.startTime ?? ""}`));
}

export function parsePunditDetailPage(html: string, event: EventStub): TalkEvent {
  const $ = cheerio.load(html);
  const productData = extractProductData(html);
  const productHtml = typeof productData?.description === "string" ? productData.description : "";
  const productText = productHtml ? htmlToText(productHtml) : "";
  const bodyText = normalizeLines($("body").text());
  const readableText = productText || detailDescription($) || $("meta[property='og:description']").attr("content") || "";
  const allText = normalizeLines(`${readableText}\n${bodyText}`);
  const ticketLinks = collectTicketLinks($, productHtml);
  const imageUrl = firstPunditImage($, $("body")) ?? normalizeImageUrl(productData?.featured_image) ?? event.imageUrl;
  const detailTitle = normalizeWhitespace(
    $("h1.product__title, .product__title h1, h1").first().text() ||
      $("meta[property='og:title']").attr("content") ||
      productData?.title ||
      "",
  );

  return {
    ...event,
    title: detailTitle && detailTitle.length < 240 ? detailTitle : event.title,
    openTime: parseOpenTime(allText) ?? event.openTime,
    startTime: parseStartTime(allText) ?? event.startTime,
    isStreaming: event.isStreaming ?? detectStreaming(`${allText}\n${ticketLinks.map((ticket) => ticket.url).join("\n")}`),
    performers: event.performers.length > 0 ? event.performers : extractPerformers(allText),
    ticketLinks,
    priceText: extractPriceText(allText) ?? event.priceText,
    description: readableText ? readableText.slice(0, 1800) : event.description,
    imageUrl,
  };
}

function parseDateFromTitle(value: string) {
  const normalized = normalizeWhitespace(value);
  const match =
    normalized.match(/(?:(20\d{2})年|(\d{2})年|(\d{2})\/)\s*(\d{1,2})月\s*(\d{1,2})日[（(]([^）)]*)[）)]/) ??
    normalized.match(/(?:(20\d{2})年|(\d{2})年|(\d{2})\/)\s*(\d{1,2})\/\s*(\d{1,2})[（(]([^）)]*)[）)]/);
  if (!match) {
    return undefined;
  }

  const year = match[1] ?? `20${match[2] ?? match[3]}`;
  const month = match[4].padStart(2, "0");
  const day = match[5].padStart(2, "0");
  const weekday = match[6].split(/[・:：]/)[0]?.trim();
  return {
    date: `${year}-${month}-${day}`,
    weekday: weekday || undefined,
  };
}

function parseOpenTime(value: string) {
  return value.match(/開場[／/:：\s]*(\d{1,2}:\d{2})/)?.[1];
}

function parseStartTime(value: string) {
  return value.match(/開演(?:＆配信スタート|・配信スタート|配信スタート)?[／/:：\s]*(\d{1,2}:\d{2})/)?.[1];
}

function detectStreaming(value: string) {
  if (/ツイキャス|twitcasting|配信チケット|配信スタート|アーカイブ|premier\.twitcasting/i.test(value)) {
    return true;
  }
  if (/配信なし|会場観覧のみ|会場のみ/.test(value)) {
    return false;
  }
  return undefined;
}

function extractPerformers(value: string) {
  const sectionMatch = value.match(/【出演】([\s\S]*?)(?:【|$)/);
  const source = sectionMatch?.[1] ?? value;
  return source
    .split(/\n|、|,|\/|／| VS | vs |×| x /i)
    .map((part) => part.replace(/^[●・\s]+/, "").trim())
    .filter((part) => part && !/^\d{2,4}年/.test(part) && part.length < 80)
    .slice(0, 12);
}

function firstPunditImage($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>) {
  const candidates: string[] = [
    $("meta[property='og:image:secure_url']").attr("content") ?? "",
    $("meta[property='og:image']").attr("content") ?? "",
    $("meta[name='twitter:image']").attr("content") ?? "",
  ];

  root.find("img").each((_, element) => {
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

  const image = candidates
    .map(normalizeImageUrl)
    .find((src): src is string => typeof src === "string" && isLikelyPunditImage(src));
  return image;
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

function isLikelyPunditImage(src: string) {
  const lower = src.toLowerCase();
  if (!/\.(jpg|jpeg|png|webp)(\?|#|$)/.test(lower)) {
    return false;
  }
  if (/logo|icon|button|banner|blank|loading|payment|shopify_pay/.test(lower)) {
    return false;
  }
  return /pundit\.jp\/cdn\/shop\/files\//.test(lower);
}

function collectTicketLinks($: cheerio.CheerioAPI, productHtml: string) {
  const links: TicketLink[] = [];
  const seen = new Set<string>();
  const product$ = cheerio.load(productHtml || "<body></body>");

  for (const api of [$, product$]) {
    api("a[href]").each((_, element) => {
      const href = api(element).attr("href");
      if (!href) {
        return;
      }
      const label = normalizeWhitespace(api(element).text()) || "チケット";
      const url = absoluteUrl(href);
      const text = `${label} ${url}`.toLowerCase();
      if (/ticket|livepocket|peatix|twitcasting|shopcart|チケット|配信|予約|購入/.test(text) && !seen.has(url)) {
        seen.add(url);
        links.push({ label: label.slice(0, 60), url });
      }
    });
  }

  return links;
}

function extractPriceText(value: string) {
  const match = value.match(/【料金】([\s\S]*?)(?:【|$)/);
  return match ? normalizeLines(match[0]).slice(0, 700) : undefined;
}

function detailDescription($: cheerio.CheerioAPI) {
  return $(".product__description p, .product__description, main p")
    .map((_, element) => normalizeWhitespace($(element).text()))
    .get()
    .filter((text) => text.length > 20)
    .slice(0, 10)
    .join("\n")
    .slice(0, 1800);
}

function extractProductData(html: string): { title?: string; description?: string; featured_image?: string } | undefined {
  const marker = "productData:";
  const start = html.indexOf(marker);
  if (start === -1) {
    return undefined;
  }
  const objectStart = html.indexOf("{", start + marker.length);
  if (objectStart === -1) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      escaped = char === "\\" && !escaped;
      if (char === '"' && !escaped) {
        inString = false;
      }
      if (char !== "\\") {
        escaped = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(objectStart, index + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

function htmlToText(value: string) {
  const $ = cheerio.load(value.replace(/<br\s*\/?>/gi, "\n"));
  return normalizeLines($.text());
}

function relevantDateRange() {
  const today = new Date();
  const min = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
  const max = new Date(today.getFullYear(), today.getMonth() + 4, today.getDate());
  return { minDate: formatDate(min), maxDate: formatDate(max) };
}

function formatDate(value: Date) {
  return [
    String(value.getFullYear()),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeImageUrl(value: unknown) {
  return typeof value === "string" && value ? absoluteUrl(value.replace(/^\/\//, "https://")) : undefined;
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
