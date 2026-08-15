import { Fragment } from "react";

interface HighlightProps {
  text: string;
  query: string;
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* Marks the searched substring so results explain themselves. */
const Highlight = ({ text, query }: HighlightProps) => {
  const needle = query.trim();

  if (!needle) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegex(needle)})`, "ig"));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark key={index} className="hl">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </>
  );
};

export default Highlight;
