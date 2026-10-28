import type { Destination, IndiaRelevance, NewsCategory } from "@/lib/types";

/**
 * Rule-based news classification. Deterministic and explainable: it never invents facts,
 * it only labels a story from words that actually appear in its title and summary.
 */

/** Cities, regions and alternate names that identify a destination. */
const ALIASES: Record<string, string[]> = {
  Japan: ["japan", "japanese", "tokyo", "kyoto", "osaka", "hokkaido", "okinawa", "jnto", "fukuoka", "nagoya", "hiroshima"],
  Morocco: ["morocco", "moroccan", "marrakech", "marrakesh", "casablanca", "fes", "fez", "chefchaouen", "tangier", "agadir"],
  Philippines: ["philippines", "philippine", "filipino", "manila", "cebu", "boracay", "palawan", "el nido", "bohol", "siargao"],
  Austria: ["austria", "austrian", "vienna", "salzburg", "innsbruck", "tyrol", "hallstatt"],
  "South Korea": ["south korea", "korea", "korean", "seoul", "busan", "jeju", "incheon", "k-pop", "k-drama"],
  Spain: ["spain", "spanish", "madrid", "barcelona", "seville", "andalusia", "ibiza", "mallorca", "valencia", "turespana", "turespaña"],
  "New Zealand": ["new zealand", "auckland", "queenstown", "wellington", "christchurch", "rotorua"],
  Azerbaijan: ["azerbaijan", "azerbaijani", "baku", "gabala", "shahdag"],
  Ireland: ["ireland", "irish", "dublin", "galway", "cork", "belfast"],
  Uzbekistan: ["uzbekistan", "uzbek", "tashkent", "samarkand", "bukhara", "khiva"],
  Taiwan: ["taiwan", "taiwanese", "taipei", "kaohsiung", "taichung"],
  Vietnam: ["vietnam", "vietnamese", "hanoi", "ho chi minh", "da nang", "ha long", "hoi an", "phu quoc", "vietjet"],
  "South Africa": ["south africa", "south african", "cape town", "johannesburg", "durban", "kruger"],
  Switzerland: ["switzerland", "swiss", "zurich", "geneva", "lucerne", "interlaken", "zermatt", "jungfrau"],
  Oman: ["oman", "omani", "muscat", "salalah", "nizwa"],
  // Other markets frequently in Indian outbound news (not in the starting directory).
  Thailand: ["thailand", "thai ", "bangkok", "phuket", "pattaya", "krabi", "chiang mai"],
  Singapore: ["singapore"],
  "United Arab Emirates": ["uae", "dubai", "abu dhabi", "emirates", "sharjah", "ras al khaimah"],
  Malaysia: ["malaysia", "kuala lumpur", "langkawi", "penang"],
  Indonesia: ["indonesia", "bali", "jakarta"],
  "Sri Lanka": ["sri lanka", "colombo"],
  Maldives: ["maldives"],
  Australia: ["australia", "australian", "sydney", "melbourne", "queensland", "perth"],
  "United Kingdom": ["united kingdom", " uk ", "britain", "london", "scotland", "visitbritain"],
  "United States": ["united states", "usa", "u.s.", "new york", "las vegas", "california"],
  France: ["france", "french", "paris", "atout france"],
  Italy: ["italy", "italian", "rome", "venice", "milan", "enit"],
  Germany: ["germany", "german", "berlin", "munich", "frankfurt"],
  Turkey: ["turkey", "türkiye", "turkiye", "istanbul", "cappadocia"],
  Egypt: ["egypt", "cairo"],
  Kenya: ["kenya", "nairobi"],
  Mauritius: ["mauritius"],
  Bhutan: ["bhutan"],
  Nepal: ["nepal", "kathmandu"],
  Georgia: ["georgia tbilisi", "tbilisi", "batumi"],
  Kazakhstan: ["kazakhstan", "almaty", "astana"],
  "Hong Kong": ["hong kong"],
  "Saudi Arabia": ["saudi", "riyadh", "alula", "jeddah"],
  Qatar: ["qatar", "doha"],
  Greece: ["greece", "greek", "athens", "santorini"],
  Finland: ["finland", "finnish", "helsinki", "lapland"],
  Norway: ["norway", "norwegian", "oslo"],
  Iceland: ["iceland", "reykjavik"],
  Canada: ["canada", "canadian", "toronto", "vancouver"],
  China: ["china", "chinese", "beijing", "shanghai"],
};

const CONTINENT: Record<string, string> = {
  Thailand: "Asia", Singapore: "Asia", "United Arab Emirates": "Asia", Malaysia: "Asia", Indonesia: "Asia", "Sri Lanka": "Asia",
  Maldives: "Asia", Australia: "Oceania", "United Kingdom": "Europe", "United States": "North America", France: "Europe",
  Italy: "Europe", Germany: "Europe", Turkey: "Europe", Egypt: "Africa", Kenya: "Africa", Mauritius: "Africa", Bhutan: "Asia",
  Nepal: "Asia", Georgia: "Asia", Kazakhstan: "Asia", "Hong Kong": "Asia", "Saudi Arabia": "Asia", Qatar: "Asia", Greece: "Europe",
  Finland: "Europe", Norway: "Europe", Iceland: "Europe", Canada: "North America", China: "Asia",
};

const CATEGORY_RULES: [NewsCategory, RegExp][] = [
  ["Visa & entry", /\b(visa|e-visa|evisa|visa-free|visa on arrival|entry requirement|entry rules|passport holders|immigration|eta\b|electronic travel authori[sz]ation)/],
  ["Connectivity", /\b(flights?|non-stop|nonstop|direct service|new route|routes?\b|frequenc(y|ies)|airline|airways|air india|indigo|seat capacity|codeshare|inaugural)/],
  ["Board business", /\b(representation|representative|appoint(s|ed|ment)?|agency of record|tender|roadshow|sales mission|mou\b|memorandum|co-marketing|partners? with|partnership|tie[- ]up|india office|trade mission|b2b)/],
  ["Tourism-board campaign", /\b(campaign|brand ambassador|ambassador|ad film|tvc|creator|influencer|launches .*(film|series|initiative)|marketing push)/],
  ["Events & festivals", /\b(festival|carnival|concert|expo\b|exhibition|marathon|grand prix|f1\b|world cup|olympic|celebration|fair\b|biennale|tournament)/],
  ["Indian outbound", /\b(indian (travell?ers|tourists|visitors|holidaymakers)|outbound|arrivals from india|visitors from india|tourists from india|india source market|footfall from india)/],
  ["Investment & development", /\b(invest(ment|s|ing)?|infrastructure|new attraction|theme park|opens?|opening|development|resort|hotel pipeline|airport expansion|budget allocation|dispersal|shoulder season|off-season)/],
];

export interface Classification {
  category: NewsCategory;
  destinations: string[];
  continent: string | null;
  tourism_board: string | null;
  india_relevance: IndiaRelevance;
}

function norm(s: string) {
  return ` ${s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ")} `;
}

export function detectDestinations(text: string, directory: Destination[]): string[] {
  const t = norm(text);
  const found: string[] = [];
  const names = new Set([...directory.map((d) => d.name), ...Object.keys(ALIASES)]);
  for (const name of names) {
    const aliases = ALIASES[name] ?? [name.toLowerCase()];
    if (aliases.some((a) => new RegExp(`(^|[^a-z])${a.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(t))) found.push(name);
  }
  return found.slice(0, 4);
}

export function classifyArticle(title: string, summary: string, directory: Destination[]): Classification {
  const text = `${title}. ${summary}`;
  const t = norm(text);
  const destinations = detectDestinations(text, directory);

  // Title wording decides the category first; the summary is a tie-breaker.
  const titleT = norm(title);
  const category = CATEGORY_RULES.find(([, r]) => r.test(titleT))?.[0] ?? CATEGORY_RULES.find(([, r]) => r.test(t))?.[0] ?? "Industry";

  const primary = destinations[0];
  const dirEntry = directory.find((d) => d.name === primary);
  const continent = dirEntry?.continent ?? (primary ? (CONTINENT[primary] ?? null) : null);

  let tourism_board: string | null = null;
  const boardInDir = directory.find((d) => d.tourism_board && t.includes(d.tourism_board.toLowerCase().replace(/\s*\(.*\)$/, "")));
  if (boardInDir) tourism_board = boardInDir.tourism_board;
  else {
    const m = /\b((?:[A-Z][a-zA-Z]+ ){0,3}(?:Tourism(?: Board| Authority| Organi[sz]ation| Office)?|Tourist Office|Convention (?:and|&) Visitors Bureau)|Visit [A-Z][a-zA-Z]+|Tourism [A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)?)\b/.exec(text);
    if (m && m[1].split(" ").length >= 2) tourism_board = m[1].trim();
  }

  const mentionsIndia = /\b(india|indian|indians|mumbai|delhi|bengaluru|bangalore|chennai|hyderabad|kolkata|kochi|ahmedabad|pune)\b/.test(t);
  let india_relevance: IndiaRelevance = "Low";
  if (mentionsIndia && (destinations.length || ["Visa & entry", "Connectivity", "Board business", "Tourism-board campaign", "Indian outbound"].includes(category))) india_relevance = "High";
  else if (mentionsIndia || (dirEntry && category !== "Industry")) india_relevance = "Medium";

  return { category, destinations, continent, tourism_board, india_relevance };
}

/** Normalised title key used to collapse syndicated copies of the same story. */
export function titleKey(title: string) {
  return title
    .toLowerCase()
    .replace(/\[demo\]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["the", "and", "for", "with", "from", "into", "its", "new"].includes(w))
    .slice(0, 10)
    .sort()
    .join("-");
}

export function canonicalUrl(url: string) {
  try {
    const u = new URL(url);
    [...u.searchParams.keys()].forEach((k) => {
      if (/^(utm_|fbclid|gclid|ref$|source$|cmpid|mc_)/i.test(k)) u.searchParams.delete(k);
    });
    u.hash = "";
    u.hostname = u.hostname.replace(/^(www\.|m\.|amp\.)/, "");
    u.pathname = u.pathname.replace(/\/amp\/?$/, "/").replace(/\/$/, "");
    return u.toString();
  } catch {
    return url;
  }
}

export const NEWS_CATEGORIES: NewsCategory[] = [
  "Tourism-board campaign",
  "Board business",
  "Indian outbound",
  "Connectivity",
  "Visa & entry",
  "Events & festivals",
  "Investment & development",
  "Industry",
];

export function continentFor(name: string, directory: Destination[]) {
  return directory.find((d) => d.name === name)?.continent ?? CONTINENT[name] ?? null;
}
