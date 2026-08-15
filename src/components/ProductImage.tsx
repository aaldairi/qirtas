const PLACEHOLDER =
  "bg-[repeating-linear-gradient(135deg,#e7e3d9_0_8px,#f3f0e9_8px_16px)]";

function publicUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

/**
 * Falls back to the woven placeholder from the design when a shop hasn't
 * photographed an item yet — which is the common case on day one.
 */
export function ProductImage({
  path,
  alt,
  className = "",
}: {
  path: string | null;
  alt: string;
  className?: string;
}) {
  if (!path) {
    return <span aria-hidden="true" className={`block ${PLACEHOLDER} ${className}`} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={publicUrl(path)}
      alt={alt}
      loading="lazy"
      className={`block object-cover ${className}`}
    />
  );
}
