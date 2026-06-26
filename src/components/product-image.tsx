/**
 * Product image with a graceful placeholder. Renders the real image when a URL is provided;
 * otherwise a deterministic gradient tile with the category icon (so the storefront looks
 * visual even before real photos are uploaded).
 */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function ProductImage({
  src,
  alt,
  icon,
  className = "",
}: {
  src?: string | null;
  alt: string;
  icon?: string | null;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`object-cover ${className}`} />;
  }
  const hue = hash(alt) % 360;
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 55% 60%), hsl(${(hue + 45) % 360} 60% 42%))`,
      }}
      aria-label={alt}
    >
      <span className="text-4xl opacity-90 drop-shadow" aria-hidden>
        {icon ?? "🏠"}
      </span>
    </div>
  );
}
