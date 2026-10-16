import { Package, ScanLine, Truck, ArrowUpRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { photos } from '@/lib/photography';

const chapters = [
  { number: '01', phase: 'THE FIRST MILE', title: 'A label. A beginning.', description: 'Book the shipment and give every parcel its own QR and barcode. From the first pickup, there’s a reference to follow.', image: photos.packaging, alt: 'Warehouse worker carefully preparing a labelled parcel', icon: Package, steps: ['Book & label', 'Pick up'] },
  { number: '02', phase: 'THE HANDOVER', title: 'Different hands. Same story.', description: 'A hub scan connects the parcel to its lot. Managers organise the work; riders claim their parcels through a sorting scan.', image: photos.scanner, alt: 'A parcel label being scanned during warehouse sorting', icon: ScanLine, steps: ['Hub scan', 'Sort & assign'] },
  { number: '03', phase: 'THE FINAL MILE', title: 'The last scan matters.', description: 'Follow recorded delivery events, verify the recipient and keep COD amounts in view. The journey ends with a confirmed handover.', image: photos.handover, alt: 'Delivery rider handing a parcel to its recipient', icon: Truck, steps: ['In transit', 'Deliver'] },
];

export function ParcelJourney() {
  return (
    <section className="parcel-journey border-y bg-muted/50" aria-labelledby="journey-heading">
      <div className="public-container py-16 sm:py-20">
        <div data-reveal className="flex flex-wrap items-end justify-between gap-6">
          <div><p className="eyebrow">Follow the parcel</p><h2 id="journey-heading" className="section-heading mt-3">One journey.<br /><span className="font-serif italic font-normal">Every mile connected.</span></h2></div>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">From the first label to the final doorstep. Nothing lost between handovers.</p>
        </div>
        <div className="journey-body relative mt-14">
          <svg className="journey-route journey-route-desktop" viewBox="0 0 1000 1500" preserveAspectRatio="none" aria-hidden="true">
            <path className="route-track" d="M500 0 C525 250 475 500 500 750 S525 1250 500 1500" />
            <path data-route-path className="route-ink" d="M500 0 C525 250 475 500 500 750 S525 1250 500 1500" />
          </svg>
          <svg className="journey-route journey-route-mobile" viewBox="0 0 24 1500" preserveAspectRatio="none" aria-hidden="true"><path className="route-track" d="M12 0 V1500" /><path data-route-path className="route-ink" d="M12 0 V1500" /></svg>
          <ol className="relative space-y-16 sm:space-y-20">
            {chapters.map((chapter, index) => (
              <li key={chapter.number} className={`journey-chapter ${index % 2 ? 'journey-chapter-reverse' : ''}`}>
                <div data-journey-image className="photo-frame journey-photo aspect-[4/3]"><img src={chapter.image} alt={chapter.alt} width={1280} height={1024} loading="lazy" /></div>
                <div data-reveal className="journey-copy">
                  <div className="flex items-center gap-3"><span data-route-stop className="journey-stop grid size-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-background text-primary"><chapter.icon className="size-4" /></span><p className="font-mono text-[11px] text-primary">{chapter.number} / {chapter.phase}</p></div>
                  <h3 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl">{chapter.title}</h3>
                  <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">{chapter.description}</p>
                  <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-medium"><span>{chapter.steps[0]}</span><span className="h-px w-8 bg-primary/40" /><span>{chapter.steps[1]}</span></div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-14 flex justify-center"><Link to="/solutions" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">See the complete operation<ArrowUpRight className="size-4" /></Link></div>
      </div>
    </section>
  );
}