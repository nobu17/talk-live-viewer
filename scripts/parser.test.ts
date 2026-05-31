import { describe, expect, it } from "vitest";
import { buildMonthUrls } from "./fetch-events";
import { parseDommuneDetailPage, parseDommuneSchedulePage } from "./dommune-parser";
import { mergeDuplicateEvents, parseDetailPage, parseSchedulePage } from "./parser";
import { parsePunditDetailPage, parsePunditSchedulePage } from "./pundit-parser";
import type { Venue } from "../src/types";

const venue: Venue = {
  id: "plusone",
  name: "LOFT/PLUS ONE",
  scheduleUrl: "https://www.loft-prj.co.jp/schedule/plusone/schedule",
};

describe("parser", () => {
  it("extracts event stubs and streaming availability from a schedule page", () => {
    const stubs = parseSchedulePage(
      `<a href="/schedule/plusone/352933">2026 05 06 Wednesday 配信 あり サンプルトーク OPEN 18:30 - START 19:00 出演者A 出演者B</a>`,
      venue,
      "2026-05-30T00:00:00.000Z",
    );

    expect(stubs).toHaveLength(1);
    expect(stubs[0]).toMatchObject({
      id: "plusone-352933",
      date: "2026-05-06",
      weekday: "Wednesday",
      openTime: "18:30",
      startTime: "19:00",
      isStreaming: true,
    });
  });

  it("extracts explicit no-streaming events from a schedule page", () => {
    const stubs = parseSchedulePage(
      `<a href="/schedule/plusone/352934">2026 05 07 Thursday 配信 なし サンプルトーク OPEN 18:30 - START 19:00 出演者A</a>`,
      venue,
      "2026-05-30T00:00:00.000Z",
    );

    expect(stubs[0].isStreaming).toBe(false);
  });

  it("enriches an event from a detail page", () => {
    const [stub] = parseSchedulePage(
      `<a href="/schedule/plusone/352933">2026 05 06 Wednesday サンプルトーク OPEN 18:30 - START 19:00</a>`,
      venue,
      "2026-05-30T00:00:00.000Z",
    );

    const event = parseDetailPage(
      `<main><h1>詳細タイトル</h1><img src="/uploads/sample.jpg"><p>前売 2500円 / 当日 3000円</p><p>イベントの長い説明文です。出演者と企画内容を紹介します。</p><a href="https://tiget.net/events/1">予約</a></main>`,
      stub,
    );

    expect(event.title).toBe("詳細タイトル");
    expect(event.imageUrl).toBe("https://www.loft-prj.co.jp/uploads/sample.jpg");
    expect(event.ticketLinks[0].url).toBe("https://tiget.net/events/1");
    expect(event.priceText).toContain("前売");
  });

  it("ignores social button images when selecting an event image", () => {
    const [stub] = parseSchedulePage(
      `<a href="/schedule/plusone/352933">2026 05 06 Wednesday サンプルトーク OPEN 18:30 - START 19:00</a>`,
      venue,
      "2026-05-30T00:00:00.000Z",
    );

    const event = parseDetailPage(
      `<main><img src="https://b.hatena.ne.jp/images/entry-button/button-only@2x.png"><img src="/wp-content/uploads/2026/05/event.jpg"></main>`,
      stub,
    );

    expect(event.imageUrl).toBe("https://www.loft-prj.co.jp/wp-content/uploads/2026/05/event.jpg");
  });

  it("ignores small generated logo-sized images", () => {
    const [stub] = parseSchedulePage(
      `<a href="/schedule/plusone/352933">2026 05 06 Wednesday サンプルトーク OPEN 18:30 - START 19:00</a>`,
      venue,
      "2026-05-30T00:00:00.000Z",
    );

    const event = parseDetailPage(
      `<main><img src="/schedule/wp-content/uploads/2019/03/logo-120x27.jpg"><img src="/schedule/wp-content/uploads/2026/05/event-640x360.jpg"></main>`,
      stub,
    );

    expect(event.imageUrl).toBe("https://www.loft-prj.co.jp/schedule/wp-content/uploads/2026/05/event-640x360.jpg");
  });

  it("infers streaming availability from detail links", () => {
    const [stub] = parseSchedulePage(
      `<a href="/schedule/plusone/352933">2026 05 06 Wednesday サンプルトーク OPEN 18:30 - START 19:00</a>`,
      venue,
      "2026-05-30T00:00:00.000Z",
    );

    const event = parseDetailPage(
      `<main><h1>詳細タイトル</h1><p>配信チケットも販売します。アーカイブ配信あり。</p><a href="https://twitcasting.tv/example/shopcart/1">配信チケット</a></main>`,
      stub,
    );

    expect(event.isStreaming).toBe(true);
  });

  it("does not override explicit no-streaming from the schedule page", () => {
    const [stub] = parseSchedulePage(
      `<a href="/schedule/plusone/352934">2026 05 07 Thursday 配信 なし サンプルトーク OPEN 18:30 - START 19:00</a>`,
      venue,
      "2026-05-30T00:00:00.000Z",
    );

    const event = parseDetailPage(
      `<main><h1>詳細タイトル</h1><p>配信チケットという単語が本文に紛れています。</p></main>`,
      stub,
    );

    expect(event.isStreaming).toBe(false);
  });

  it("keeps one event per normalized id", () => {
    const event = {
      id: "plusone-1",
      venueId: "plusone",
      venueName: "LOFT/PLUS ONE",
      sourceUrl: venue.scheduleUrl,
      detailUrl: "https://example.com/1",
      title: "a",
      date: "2026-05-06",
      performers: [],
      ticketLinks: [],
      fetchedAt: "2026-05-30T00:00:00.000Z",
    };

    expect(mergeDuplicateEvents([event, { ...event, title: "b" }])).toHaveLength(1);
  });

  it("builds the previous month, current month, and three future months by default", () => {
    expect(buildMonthUrls(venue.scheduleUrl, 5, new Date("2026-04-01T00:00:00+09:00"))).toEqual([
      "https://www.loft-prj.co.jp/schedule/plusone/schedule?schedulemonth=4&scheduleyear=2026",
      "https://www.loft-prj.co.jp/schedule/plusone/schedule?schedulemonth=5&scheduleyear=2026",
      "https://www.loft-prj.co.jp/schedule/plusone/schedule?schedulemonth=6&scheduleyear=2026",
      "https://www.loft-prj.co.jp/schedule/plusone/schedule?schedulemonth=7&scheduleyear=2026",
      "https://www.loft-prj.co.jp/schedule/plusone/schedule?schedulemonth=8&scheduleyear=2026",
    ]);
  });

  it("builds only the DOMMUNE top page URL", () => {
    expect(buildMonthUrls("https://www.dommune.com/", 5, new Date("2026-04-01T00:00:00+09:00"), "dommune")).toEqual([
      "https://www.dommune.com/",
    ]);
  });

  it("extracts DOMMUNE schedule teasers", () => {
    const stubs = parseDommuneSchedulePage(
      `<article class="ScheduleTeaser">
        <a class="ScheduleTeaser__link" href="/streamings/2026/060101/" target="_blank">
          <img class="ScheduleTeaser__thumbnail lazy" src="/module/images/loading.jpg" data-src="/streamings/2026/images/060101.jpg">
          <div class="ScheduleTeaser__header">
            <time class="ScheduleTeaser__date">
              <span class="ScheduleTeaser__month">Jun</span>
              <span class="ScheduleTeaser__day">01</span>
              <span class="ScheduleTeaser__weekday">MON</span>
            </time>
            <h3 class="ScheduleTeaser__title">DOMMUNE PROGRAM
●出演：Artist A、Artist B</h3>
          </div>
          <div class="ScheduleTeaser__footer"><time class="ScheduleTeaser__time">19:00–21:00</time></div>
        </a>
      </article>`,
      {
        id: "dommune",
        name: "DOMMUNE",
        scheduleUrl: "https://www.dommune.com/",
        provider: "dommune",
      },
      "2026-05-30T00:00:00.000Z",
    );

    expect(stubs[0]).toMatchObject({
      id: "dommune-060101",
      date: "2026-06-01",
      weekday: "MON",
      startTime: "19:00",
      isStreaming: true,
      imageUrl: "https://www.dommune.com/streamings/2026/images/060101.jpg",
      performers: ["Artist A", "Artist B"],
    });
  });

  it("enriches DOMMUNE events from detail pages", () => {
    const [stub] = parseDommuneSchedulePage(
      `<article class="ScheduleTeaser">
        <a class="ScheduleTeaser__link" href="/streamings/2026/060101/">
          <span class="ScheduleTeaser__month">Jun</span>
          <span class="ScheduleTeaser__day">01</span>
          <h3 class="ScheduleTeaser__title">DOMMUNE PROGRAM</h3>
        </a>
      </article>`,
      {
        id: "dommune",
        name: "DOMMUNE",
        scheduleUrl: "https://www.dommune.com/",
        provider: "dommune",
      },
      "2026-05-30T00:00:00.000Z",
    );

    const event = parseDommuneDetailPage(
      `<main><h1>DOMMUNE DETAIL</h1><img src="/streamings/2026/images/060101-detail.jpg"><p>This is a long DOMMUNE event description for the parser test.</p></main>`,
      stub,
    );

    expect(event.title).toBe("DOMMUNE DETAIL");
    expect(event.isStreaming).toBe(true);
    expect(event.imageUrl).toBe("https://www.dommune.com/streamings/2026/images/060101-detail.jpg");
  });

  it("builds Pundit collection page URLs", () => {
    expect(
      buildMonthUrls(
        "https://pundit.jp/collections/p1%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88",
        3,
        new Date("2026-04-01T00:00:00+09:00"),
        "pundit",
      ),
    ).toEqual([
      "https://pundit.jp/collections/p1%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88",
      "https://pundit.jp/collections/p1%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88?page=2",
      "https://pundit.jp/collections/p1%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88?page=3",
    ]);
  });

  it("extracts Pundit collection product cards", () => {
    const stubs = parsePunditSchedulePage(
      `<li class="grid__item">
        <div class="card-wrapper product-card-wrapper">
          <img src="//pundit.jp/cdn/shop/files/event.jpg?v=1&width=533" alt="26年6月2日（火）北芝健 VS 溝呂木一美">
          <h3 class="card__heading h5">
            <a href="/products/26p1-6-2" class="full-unstyled-link">26年6月2日（火）北芝健 VS 溝呂木一美</a>
          </h3>
          <span class="price-item price-item--regular">¥2,000</span>
        </div>
      </li>`,
      {
        id: "pundit",
        name: "高円寺Pundit",
        scheduleUrl: "https://pundit.jp/collections/p1イベント",
        provider: "pundit",
      },
      "2026-05-30T00:00:00.000Z",
    );

    expect(stubs[0]).toMatchObject({
      id: "pundit-26p1-6-2",
      date: "2026-06-02",
      weekday: "火",
      imageUrl: "https://pundit.jp/cdn/shop/files/event.jpg?v=1&width=533",
      priceText: "¥2,000",
    });
  });

  it("enriches Pundit events from detail pages", () => {
    const [stub] = parsePunditSchedulePage(
      `<li class="grid__item">
        <a href="/products/26p1-6-2" class="full-unstyled-link">26年6月2日（火）北芝健 VS 溝呂木一美</a>
      </li>`,
      {
        id: "pundit",
        name: "高円寺Pundit",
        scheduleUrl: "https://pundit.jp/collections/p1イベント",
        provider: "pundit",
      },
      "2026-05-30T00:00:00.000Z",
    );

    const event = parsePunditDetailPage(
      `<main>
        <h1 class="product__title">26年6月2日（火）北芝健 VS 溝呂木一美</h1>
        <meta property="og:image:secure_url" content="https://pundit.jp/cdn/shop/files/event-detail.jpg?v=1">
        <div class="product__description">
          <p>【出演】<br>●北芝健<br>●溝呂木一美</p>
          <p>【時間】<br>開場／19:00<br>開演＆配信スタート／19:30</p>
          <p>【料金】＜会場観覧＞<br>前売り ¥2,000</p>
          <a href="https://premier.twitcasting.tv/pundit_koenji/shopcart/1">ツイキャス配信</a>
        </div>
      </main>`,
      stub,
    );

    expect(event.openTime).toBe("19:00");
    expect(event.startTime).toBe("19:30");
    expect(event.isStreaming).toBe(true);
    expect(event.ticketLinks[0].url).toBe("https://premier.twitcasting.tv/pundit_koenji/shopcart/1");
    expect(event.priceText).toContain("前売り");
  });
});
