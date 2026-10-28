import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { DestinationCarousel, type Slide } from "@/components/landing/carousel";
import { findPhoto } from "@/lib/images";
import destinations from "@/data/destinations.json";

export const revalidate = 86400;

const FEATURED: { name: string; place: string }[] = [
  { name: "Japan", place: "Fushimi Inari Taisha, Kyoto" },
  { name: "Morocco", place: "Chefchaouen, Rif Mountains" },
  { name: "Philippines", place: "El Nido, Palawan" },
  { name: "Austria", place: "Hallstatt, Upper Austria" },
  { name: "South Korea", place: "Gyeongbokgung, Seoul" },
  { name: "Spain", place: "Plaza de España, Seville" },
  { name: "New Zealand", place: "Milford Sound, Fiordland" },
  { name: "Azerbaijan", place: "Baku, Absheron Peninsula" },
];

async function loadSlides(): Promise<Slide[]> {
  return Promise.all(
    FEATURED.map(async (f) => {
      const d = destinations.find((x) => x.name === f.name)!;
      const image = await Promise.race([
        findPhoto(d.photo_query, { file: d.photo_file, alt: `${f.place}, ${f.name}` }),
        new Promise<null>((r) => setTimeout(() => r(null), 8000)),
      ]);
      return { name: f.name, place: f.place, line: d.tagline ?? "", image };
    }),
  );
}

export default async function Landing() {
  const slides = await loadSlides();
  return (
    <div className="relative min-h-screen overflow-hidden bg-ivory">
      {/* Story motif: a quiet route line that wanders behind the page, ending in the brand full stop. */}
      <svg className="pointer-events-none absolute inset-x-0 top-0 h-[560px] w-full text-ink/[0.09]" viewBox="0 0 1440 560" preserveAspectRatio="none" aria-hidden>
        <path className="route-line" d="M-20 420 C 220 300, 360 520, 600 380 S 980 160, 1180 300 S 1400 420, 1470 250" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      <header className="relative z-10 mx-auto flex max-w-[1360px] items-end justify-between px-5 pt-5 md:px-10">
        <div className="flex items-baseline gap-4">
          <Wordmark className="text-[26px] md:text-[28px]" />
          <p className="hidden text-[13px] text-muted sm:block">There&apos;s always another story.</p>
        </div>
        <Link href="/home" className="rounded-full px-4 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-ink/5 hover:text-ink">
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mt-5 md:mt-6">
        <DestinationCarousel
          slides={slides}
          overlay={
            <div className="max-w-3xl text-center text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]">
              <p className="animate-fade-up text-[12px] font-medium uppercase tracking-[0.2em] text-white/80">Travel intelligence · Destination research · Campaign studio</p>
              <h1 className="mt-4 animate-fade-up text-[42px] font-semibold leading-[1.02] tracking-[-0.045em] [animation-delay:80ms] sm:text-[58px] lg:text-[76px]">
                Ready to make Indians travel<span className="text-[#9db4ff]">?</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl animate-fade-up text-[16px] leading-relaxed text-white/90 [animation-delay:160ms] md:text-[18px]">
                The world&apos;s full of stories waiting to be found. Let&apos;s turn them into something worth travelling for.
              </p>
              <div className="pointer-events-auto mt-8 animate-fade-up [animation-delay:240ms] [text-shadow:none]">
                <Link
                  href="/home"
                  className="group inline-flex h-14 items-center gap-2.5 rounded-full bg-white pl-7 pr-6 text-[16px] font-medium text-ink shadow-[0_12px_40px_-8px_rgba(0,0,0,0.45)] transition-colors hover:bg-accent hover:text-white"
                >
                  Let&apos;s explore
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            </div>
          }
        />
        <p className="mx-auto mt-10 max-w-2xl px-5 pb-12 text-center text-[15px] text-muted">
          Spot the shift, research the destination, plot the campaign, find the right people and keep the partnership moving. One connected story.
        </p>
      </main>

      <footer className="relative z-10 mx-auto flex max-w-[1360px] flex-col gap-2 px-5 pb-8 text-[12px] text-muted md:flex-row md:justify-between md:px-10">
        <span>
          plot twist<span className="text-accent">.</span> Internal tool for the marketing and tourism partnerships team.
        </span>
        <span>Photography: Wikimedia Commons contributors, used under their stated licences. Destination lines are creative copy, not sourced facts.</span>
      </footer>
    </div>
  );
}
