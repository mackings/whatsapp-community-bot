const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** Renders text with any http(s) URLs turned into clickable links. */
export function LinkedText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-300"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
