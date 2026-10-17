import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ScanLine, PackagePlus, ShieldCheck, Wallet } from "lucide-react";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, ScrollTrigger);

const STEPS = [
  { icon: ScanLine, k: "01", t: "Scan the barcode", d: "Camera reads the label in under a second. No typing, no mistakes." },
  { icon: PackagePlus, k: "02", t: "Load the bucket", d: "Only parcels in a rider's bucket can be delivered — ownership is never in doubt." },
  { icon: ShieldCheck, k: "03", t: "Deliver with OTP", d: "Customer code confirms the handover. Cancel also needs their OTP." },
  { icon: Wallet, k: "04", t: "Get paid instantly", d: "Wallet credits and franchise commissions post automatically." },
];
const BARS = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 3, 1, 2, 1];

/** Pinned scroll story: a barcode is scanned while the four delivery steps slide past. */
export function BarcodeStory() {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
      const track = root.current!.querySelector<HTMLElement>("[data-track]")!;
      const dist = () => track.scrollWidth - window.innerWidth + 96;
      const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${dist() + 600}`, pin: true, scrub: 0.8, invalidateOnRefresh: true } });
      tl.to(track, { x: () => -dist(), ease: "none" }, 0)
        .fromTo("[data-beam]", { yPercent: -10 }, { yPercent: 1000, ease: "sine.inOut", repeat: 3, yoyo: true, duration: 0.25 }, 0)
        .fromTo("[data-bar]", { scaleY: 0.2, opacity: 0.3 }, { scaleY: 1, opacity: 1, stagger: 0.01, ease: "power2.out", duration: 0.3 }, 0)
        .fromTo("[data-progress]", { scaleX: 0 }, { scaleX: 1, ease: "none" }, 0);
      gsap.utils.toArray<HTMLElement>("[data-step]").forEach((el) => {
        gsap.from(el.querySelector("[data-step-icon]"), { rotate: -90, scale: 0.4, scrollTrigger: { trigger: el, containerAnimation: tl, start: "left 85%", end: "left 50%", scrub: true } });
      });
    });
    mm.add("(prefers-reduced-motion: no-preference) and (max-width: 767px)", () => {
      gsap.utils.toArray<HTMLElement>("[data-step]").forEach((el) => gsap.from(el, { x: 60, opacity: 0, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } }));
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <section ref={root} aria-label="How a parcel moves" className="relative overflow-hidden bg-navy text-navy-foreground">
      <div className="flex min-h-screen flex-col justify-center gap-10 py-16 md:py-0">
        <div className="public-container grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime">Barcode-first, end to end</p>
            <h2 className="section-heading mt-3 max-w-xl">One scan starts the whole journey.</h2>
          </div>
          <div className="relative h-28 w-72 overflow-hidden rounded-2xl border border-navy-foreground/20 bg-background/95 p-4" aria-hidden>
            <div className="flex h-full items-stretch gap-[3px]">
              {BARS.map((w, i) => <span key={i} data-bar className="origin-bottom rounded-[1px] bg-foreground" style={{ width: w * 2 }} />)}
            </div>
            <span data-beam className="absolute inset-x-2 top-1 h-[3px] rounded-full bg-coral shadow-[0_0_18px_4px_var(--coral)]" />
          </div>
        </div>
        <div className="public-container"><div className="h-px w-full bg-navy-foreground/15"><div data-progress className="h-px origin-left bg-lime" /></div></div>
        <div data-track className="flex flex-col gap-5 px-6 md:w-max md:flex-row md:px-12">
          {STEPS.map((s) => (
            <article key={s.k} data-step className="relative w-full shrink-0 overflow-hidden rounded-3xl border border-navy-foreground/15 bg-navy-foreground/5 p-8 backdrop-blur md:w-[420px]">
              <span className="absolute -right-4 -top-8 font-display text-[9rem] font-bold leading-none text-navy-foreground/5">{s.k}</span>
              <span data-step-icon className="grid size-14 place-items-center rounded-2xl bg-lime text-navy"><s.icon className="size-7" /></span>
              <h3 className="mt-6 font-display text-2xl font-bold">{s.t}</h3>
              <p className="mt-3 max-w-xs text-sm leading-6 text-navy-foreground/75">{s.d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
