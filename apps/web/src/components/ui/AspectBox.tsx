import type { CSSProperties, ReactNode } from "react";

// Prevents layout shift — every image in the app sits inside one of these.
// `ratio` is any valid CSS aspect-ratio value ("16/9", "4/5", "1/1", ...).
export function AspectBox({
  ratio,
  children,
  className,
  style,
}: {
  ratio: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ position: "relative", aspectRatio: ratio, overflow: "hidden", ...style }}
    >
      {children}
    </div>
  );
}
