export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="no-print flex min-h-[70px] flex-wrap items-center gap-3 border-b border-line bg-paper px-5 py-3.5 lg:px-7 lg:py-0">
      <h1 className="text-lg font-medium tracking-[-0.01em]">{title}</h1>
      {meta ? <span className="num text-xs text-mute-2">{meta}</span> : null}
      {actions ? (
        <div className="ms-auto flex items-center gap-2.5">{actions}</div>
      ) : null}
    </header>
  );
}
