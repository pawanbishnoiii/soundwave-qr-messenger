import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Box, PackageCheck, ScanLine, ShieldCheck, Truck, Wallet } from "lucide-react";
import { photos } from "@/lib/photography";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, ScrollTrigger);

const STEPS = [
  { n: "01", t: "Scan into stock", d: "Every product barcode lands in the warehouse in one beep.", img: photos.scanner, icon: ScanLine },
  { n: "02", t: "Pack by location", d: "Bags and boxes fill by pincode — each bag gets its own bill.", img: photos.packaging, icon: Box },
  { n: "03", t: "Dispatch the fleet", d: "Sealed bags move to franchise hubs with a scanned manifest.", img: photos.dispatch, icon: Truck },
  { n: "04", t: "Rider bucket", d: "Riders scan parcels into their bucket before they can deliver.", img: photos.rider, icon: PackageCheck },
  { n: "05", t: "OTP at the door", d: "Customer code confirms the handover. No code, no delivery.", img: photos.handover, icon: ShieldCheck },
  { n: "06", t: "Cash comes home", d: "COD is counted, verified by code and locked in the ledger.", img: photos.merchant, icon: Wallet },
];

/** Pinned horizontal reel: vertical scroll drives the operations story sideways. */
export function OpsReel() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const track = root.current!.querySelector<HTMLElement>("[data-reel-track]")!;
      const dist = () => track.scrollWidth - window.innerWidth + 48;
      const tween = gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${dist()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true } });
      gsap.to("[data-reel-bar]", { scaleX: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${dist()}`, scrub: true } });
      gsap.utils.toArray<HTMLElement>("[data-reel-card]").forEach((card) => {
        gsap.from(card.querySelector("img"), { scale: 1.35, ease: "none", scrollTrigger: { trigger: card, containerAnimation: tween, start: "left right", end: "right left", scrub: true } });
        gsap.from(card.querySelector("[data-reel-copy]"), { y: 60, opacity: 0, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 75%" } });
      });
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <section ref={root} aria-label="How a parcel moves" className="relative overflow-hidden bg-navy py-14 text-navy-foreground md:h-screen md:py-0">
      <div className="public-container md:absolute md:inset-x-0 md:top-10 md:z-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-lime">One barcode · six handovers</p>
        <div className="mt-3 h-0.5 w-full max-w-sm overflow-hidden bg-navy-foreground/15"><div data-reel-bar className="h-full origin-left scale-x-0 bg-lime" /></div>
      </div>
      <div data-reel-track className="flex gap-6 overflow-x-auto px-6 pt-8 md:h-full md:items-center md:overflow-visible md:pl-[8vw] md:pt-0">
        <div className="hidden w-[34vw] shrink-0 md:block"><h2 className="font-display text-6xl font-bold leading-[0.95]">From shelf<br />to doorstep<span className="text-lime">.</span></h2><p className="mt-5 max-w-sm text-sm text-navy-foreground/75">Keep scrolling — follow a single parcel through every team in your network.</p></div>
        {STEPS.map((s) => (
          <article key={s.n} data-reel-card className="relative h-[420px] w-[78vw] shrink-0 overflow-hidden rounded-3xl md:h-[62vh] md:w-[30vw]">
            <img src={s.img} alt={s.t} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
            <div data-reel-copy className="absolute inset-x-0 bottom-0 p-6">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-lime text-navy"><s.icon className="size-5" /></span><span className="font-mono text-sm text-lime">{s.n}</span></div>
              <h3 className="mt-4 font-display text-2xl font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-navy-foreground/80">{s.d}</p>
            </div>
          </article>
        ))}
        <div className="w-6 shrink-0" />
      </div>
    </section>
  );
}
