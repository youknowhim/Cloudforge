import type { IconName } from "../components/Icon/Icon";

export type FileKind =
  | "image"
  | "video"
  | "audio"
  | "doc"
  | "sheet"
  | "archive"
  | "code"
  | "other";

interface KindInfo {
  kind: FileKind;
  icon: IconName;
  label: string;
  /* css custom property that carries the kind's hue */
  tone: string;
}

const KINDS: Record<FileKind, KindInfo> = {
  image: { kind: "image", icon: "image", label: "Image", tone: "var(--k-image)" },
  video: { kind: "video", icon: "video", label: "Video", tone: "var(--k-video)" },
  audio: { kind: "audio", icon: "audio", label: "Audio", tone: "var(--k-audio)" },
  doc: { kind: "doc", icon: "file", label: "Document", tone: "var(--k-doc)" },
  sheet: { kind: "sheet", icon: "sheet", label: "Spreadsheet", tone: "var(--k-doc)" },
  archive: {
    kind: "archive",
    icon: "archive",
    label: "Archive",
    tone: "var(--k-archive)",
  },
  code: { kind: "code", icon: "code", label: "Code", tone: "var(--k-code)" },
  other: { kind: "other", icon: "file", label: "File", tone: "var(--k-code)" },
};

const EXT_KINDS: Record<string, FileKind> = {
  pdf: "doc",
  doc: "doc",
  docx: "doc",
  txt: "doc",
  md: "doc",
  rtf: "doc",
  csv: "sheet",
  xls: "sheet",
  xlsx: "sheet",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  js: "code",
  ts: "code",
  tsx: "code",
  jsx: "code",
  json: "code",
  html: "code",
  css: "code",
  py: "code",
  go: "code",
  java: "code",
  sql: "code",
  sh: "code",
};

export const extensionOf = (fileName: string): string => {
  const match = /\.([^./\\]+)$/.exec(fileName ?? "");

  return match ? match[1].toLowerCase() : "";
};

export const describeFile = (
  mimeType?: string,
  fileName = ""
): KindInfo & { extension: string; kindLabel: string } => {
  const extension = extensionOf(fileName);
  const mime = (mimeType ?? "").toLowerCase();

  let kind: FileKind | undefined;

  if (mime.startsWith("image/")) kind = "image";
  else if (mime.startsWith("video/")) kind = "video";
  else if (mime.startsWith("audio/")) kind = "audio";
  else if (mime.includes("zip") || mime.includes("compressed")) kind = "archive";
  else if (mime.includes("spreadsheet") || mime.includes("excel")) kind = "sheet";
  else if (mime.includes("pdf") || mime.includes("word") || mime === "text/plain")
    kind = "doc";

  kind ??= EXT_KINDS[extension] ?? "other";

  const info = KINDS[kind];

  return {
    ...info,

    /* short badge text: "PDF", falling back to "Document" */
    label: extension ? extension.toUpperCase() : info.label,

    /* plain-English name for places with room to spell it out */
    kindLabel: info.label,

    extension,
  };
};

export const isPreviewable = (mimeType?: string): boolean => {
  const mime = (mimeType ?? "").toLowerCase();

  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime === "application/pdf"
  );
};
