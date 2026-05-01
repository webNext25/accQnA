import type { CSSProperties } from "react";
import type { Event } from "@/lib/qa/types";

type EventHeroProps = {
  event: Event;
  compact?: boolean;
};

export function EventHero({ event, compact = false }: EventHeroProps) {
  const eventImage = event.background_image_url
    ? `url(${JSON.stringify(event.background_image_url)})`
    : "linear-gradient(135deg, #111827, #475569)";

  return (
    <section
      className={`event-backdrop flex flex-col justify-end overflow-hidden rounded-b-3xl px-5 text-white shadow-xl shadow-slate-950/10 sm:px-8 ${
        compact ? "min-h-44 py-6" : "min-h-60 py-8 sm:min-h-72 sm:py-10"
      }`}
      style={{ "--event-image": eventImage } as CSSProperties}
    >
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">
          Alpha Colors Live
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[0.95] tracking-normal text-balance [overflow-wrap:anywhere] sm:text-5xl">
          {event.title}
        </h1>
        {event.subtitle ? (
          <p className="mt-4 max-w-xl text-base font-medium leading-7 text-white/80 [overflow-wrap:anywhere] sm:text-lg">
            {event.subtitle}
          </p>
        ) : null}
      </div>
    </section>
  );
}
