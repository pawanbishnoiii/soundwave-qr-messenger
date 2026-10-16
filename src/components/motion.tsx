import { useRef, type ReactNode, type ElementType } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

const reduced = "(prefers-reduced-motion: reduce)";

/** Fades/slides children with [data-reveal] in as they scroll into view, staggered. */
export function Reveal({ children, as: Tag = "div", className, stagger = 0.06, y = 18 }: { children: ReactNode; as?: ElementType; className?: string; stagger?: number; y?: number }) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(`not ${reduced}`, () => {
      const items = ref.current?.querySelectorAll("[data-reveal]");
      const targets = items && items.length ? Array.from(items) : ref.current ? [ref.current] : [];
      if (!targets.length) return;
      gsap.from(targets, {
        autoAlpha: 0, y, duration: 0.55, ease: "power3.out", stagger,
        scrollTrigger: { trigger: ref.current, start: "top 92%", once: true },
        clearProps: "opacity,visibility,transform",
      });
    });
    return () => mm.revert();
  }, { scope: ref });
  return <Tag ref={ref} className={className}>{children}</Tag>;
}

/** Animated number that counts up once when it scrolls into view. */
export function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString("en-IN"), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const el = ref.current; if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(`not ${reduced}`, () => {
      const o = { n: 0 };
      gsap.to(o, { n: value, duration: 1.1, ease: "power2.out", onUpdate: () => { el.textContent = format(o.n); },
        scrollTrigger: { trigger: el, start: "top 95%", once: true } });
    });
    mm.add(reduced, () => { el.textContent = format(value); });
    return () => mm.revert();
  }, { dependencies: [value], scope: ref });
  return <span ref={ref} className={className}>{format(value)}</span>;
}

/** Page-enter transition for the app workspace, keyed by route path. */
export function PageTransition({ path, children }: { path: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(`not ${reduced}`, () => {
      gsap.fromTo(ref.current, { autoAlpha: 0, y: 12, filter: "blur(4px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.45, ease: "power3.out", clearProps: "all" });
    });
    return () => mm.revert();
  }, { dependencies: [path], scope: ref });
  return <div ref={ref}>{children}</div>;
}

/** Horizontal scroll progress bar pinned to the top of the viewport. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.fromTo(ref.current, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
  }, { scope: ref });
  return <div ref={ref} aria-hidden className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-primary" />;
}
