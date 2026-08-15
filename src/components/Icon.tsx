type Props = {
  name: string;
  size?: number;
  className?: string;
  fill?: boolean;
  style?: React.CSSProperties;
};

/** Material Symbols Rounded glyph. Decorative by default — labels live in text. */
export function Icon({ name, size = 20, className = "", fill, style }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`ms ${fill ? "ms-fill" : ""} ${className}`}
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  );
}
