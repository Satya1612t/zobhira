import Image, { type ImageProps } from "next/image";

type Shape = "arch" | "blob" | "squircle" | "none";

const SHAPE_CLASS: Record<Shape, string> = {
  arch: "shape-arch",
  blob: "shape-blob",
  squircle: "shape-squircle",
  none: "",
};

// next/image wrapper — enforces `sizes`, quality 85, and the subtle
// hairline-outline-for-depth treatment used everywhere an image appears.
// Fill mode (used inside <AspectBox>) is the default; pass width/height for
// intrinsic sizing instead.
export function Figure({
  shape = "squircle",
  className,
  style,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  quality = 85,
  fill = true,
  alt,
  ...props
}: Omit<ImageProps, "alt"> & { alt: string; shape?: Shape }) {
  return (
    <Image
      {...props}
      alt={alt}
      fill={fill}
      sizes={sizes}
      quality={quality}
      className={`${SHAPE_CLASS[shape]} ${className ?? ""}`}
      style={{
        objectFit: "cover",
        outline: "1px solid rgba(11,20,32,.08)",
        outlineOffset: "-1px",
        borderRadius: shape === "none" ? undefined : shape === "squircle" ? "var(--radius-lg)" : undefined,
        ...style,
      }}
    />
  );
}
