import type { RawStory } from "@/lib/news/ingest";
import { DEMO_HOST } from "@/lib/fixtures/search";

/**
 * DEMO FIXTURES for offline development only (PLOT_TWIST_DEMO_FIXTURES=true).
 * These are fictional stories written to exercise classification and the UI.
 * They are titled [DEMO], point at the reserved .invalid domain and are stored with is_demo = true.
 */
export function demoStories(): RawStory[] {
  const day = 86400000;
  const now = Date.now();
  const items: [string, string, number, string][] = [
    ["[DEMO] Fictional tourism board unveils India-focused creator campaign for Japan's regional prefectures", "Fictional demo story for offline testing. A made-up India-market creator campaign about travel to Japan beyond Tokyo and Kyoto.", 1, "Demo Trade Wire"],
    ["[DEMO] Demo airline announces new non-stop route between Delhi and Tashkent, Uzbekistan", "Fictional demo story for offline testing about direct flights from India to Uzbekistan.", 2, "Demo Aviation Daily"],
    ["[DEMO] Philippines appoints India representation agency in a fictional announcement", "Fictional demo story for offline testing about India-market representation for the Philippines.", 3, "Demo Trade Wire"],
    ["[DEMO] Fictional e-visa update for Indian passport holders travelling to Azerbaijan", "Fictional demo story for offline testing about visa processing for Indian travellers to Azerbaijan.", 4, "Demo Policy Desk"],
    ["[DEMO] Austria tourism roadshow visits Mumbai and Bengaluru in a demo item", "Fictional demo story for offline testing about a roadshow in Indian cities promoting Austria in the shoulder season.", 6, "Demo Trade Wire"],
    ["[DEMO] Indian travellers show growing interest in South Korea, says a fictional survey", "Fictional demo story for offline testing about Indian outbound interest in Seoul and Jeju.", 8, "Demo Outbound Monitor"],
    ["[DEMO] Spain festival season announced for next spring in a fictional listing", "Fictional demo story for offline testing about a festival in Seville. Event dates in this demo are invented.", 10, "Demo Events Weekly"],
    ["[DEMO] Fictional investment in new attractions and resorts across Oman", "Fictional demo story for offline testing about tourism infrastructure development in Oman and Salalah.", 12, "Demo Investment Brief"],
    ["[DEMO] New Zealand promotes off-season travel to Indian families in a demo campaign", "Fictional demo story for offline testing about shoulder season travel to Queenstown for Indian families.", 15, "Demo Trade Wire"],
    ["[DEMO] Vietnam sees more flights from Indian cities in a fictional route update", "Fictional demo story for offline testing about increased frequencies from Mumbai and Kochi to Da Nang.", 20, "Demo Aviation Daily"],
  ];
  return items.map(([title, summary, ago, publisher], i) => ({
    url: `https://news.${DEMO_HOST}/story/${i + 1}`,
    title,
    summary,
    published_at: new Date(now - ago * day).toISOString(),
    publisher,
    source_name: publisher,
    image_url: null,
    via: "rss" as const,
    is_demo: true,
    content: summary,
  }));
}
