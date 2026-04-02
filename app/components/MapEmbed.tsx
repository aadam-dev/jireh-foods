const MAP_EMBED_SRC =
  "https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3970.046426039619!2d-0.14596692501372746!3d5.706432994275452!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zNcKwNDInMjMuMiJOIDDCsDA4JzM2LjIiVw!5e0!3m2!1sen!2sgh!4v1773785136071!5m2!1sen!2sgh";

export function MapEmbed() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] shadow-lg">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={MAP_EMBED_SRC}
          width="600"
          height="450"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Jireh Natural Foods location on Google Maps"
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
