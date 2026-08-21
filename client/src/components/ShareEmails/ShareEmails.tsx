import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { checkUserEmail } from "../../services/api";
import { useDebounced } from "../../lib/useDebounced";
import { initialsOf } from "../../lib/format";

import Icon from "../Icon/Icon";

import "./ShareEmails.css";

/* deliberately permissive — the backend is the real authority */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isEmail = (value: string): boolean =>
  EMAIL_RE.test(value.trim().toLowerCase());

type CheckState =
  | { kind: "idle" }
  | { kind: "invalid" }
  | { kind: "duplicate" }
  | { kind: "self" }
  | { kind: "checking" }
  | { kind: "found" }
  | { kind: "missing" }
  | { kind: "error"; message: string };

interface ShareEmailsProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
  /* your own address — sharing a file with yourself is a no-op */
  ownEmail?: string;
  /* surfaced by the parent form when it blocks submit */
  error?: string;
  autoFocus?: boolean;
}

const ShareEmails = ({
  emails,
  onChange,
  disabled = false,
  ownEmail,
  error,
  autoFocus = false,
}: ShareEmailsProps) => {
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<CheckState>({ kind: "idle" });

  const inputRef = useRef<HTMLInputElement>(null);

  /*
    Two seconds: long enough that typing an address start-to-finish
    costs exactly one request, short enough to feel like a reply.
  */
  const settled = useDebounced(draft, 2000).trim().toLowerCase();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  /* everything the debounce doesn't need to wait for, answered locally */
  const localVerdict = (value: string): CheckState | null => {
    if (!value) return { kind: "idle" };

    if (!isEmail(value)) return { kind: "invalid" };

    if (ownEmail && value === ownEmail.trim().toLowerCase()) {
      return { kind: "self" };
    }

    if (emails.includes(value)) return { kind: "duplicate" };

    return null;
  };

  /* immediate feedback while the debounce is still running */
  useEffect(() => {
    const value = draft.trim().toLowerCase();
    const local = localVerdict(value);

    setState(local ?? { kind: "checking" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, emails, ownEmail]);

  /* the debounced round-trip */
  useEffect(() => {
    if (localVerdict(settled)) return;

    const controller = new AbortController();

    setState({ kind: "checking" });

    checkUserEmail(settled, controller.signal)
      .then((exists) =>
        setState(exists ? { kind: "found" } : { kind: "missing" })
      )
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }

        setState({
          kind: "error",
          message:
            cause instanceof Error
              ? cause.message
              : "We couldn't check that address.",
        });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  const commit = () => {
    const value = draft.trim().toLowerCase();

    if (state.kind !== "found") return;

    onChange([...emails, value]);
    setDraft("");
    setState({ kind: "idle" });
  };

  const remove = (email: string) =>
    onChange(emails.filter((item) => item !== email));

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
      return;
    }

    /* backspace on an empty box peels off the last chip */
    if (event.key === "Backspace" && !draft && emails.length) {
      event.preventDefault();
      remove(emails[emails.length - 1]);
    }
  };

  const status: Record<CheckState["kind"], { tone: string; text: string }> = {
    idle: { tone: "", text: "" },
    checking: { tone: "wait", text: "Checking this address…" },
    found: { tone: "ok", text: "Found — press Enter to add them" },
    missing: { tone: "bad", text: "No CloudForge account uses this address" },
    invalid: { tone: "bad", text: "That doesn't look like an email address" },
    duplicate: { tone: "bad", text: "You've already added this person" },
    self: { tone: "bad", text: "This file is already yours" },
    error: { tone: "bad", text: "" },
  };

  const current = status[state.kind];
  const message = state.kind === "error" ? state.message : current.text;

  return (
    <div className="share-emails">
      <div className={`share-box${error ? " share-box--error" : ""}`}>
        {emails.map((email) => (
          <span key={email} className="share-chip" title={email}>
            <span className="share-chip-avatar" aria-hidden="true">
              {initialsOf(email.split("@")[0], email.slice(0, 2).toUpperCase())}
            </span>

            <span className="share-chip-email">{email}</span>

            <button
              type="button"
              className="share-chip-remove"
              aria-label={`Remove ${email}`}
              disabled={disabled}
              onClick={() => remove(email)}
            >
              <Icon name="x" size={13} strokeWidth={2.2} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="email"
          className="share-input"
          value={draft}
          disabled={disabled}
          placeholder={emails.length ? "Add another person" : "name@example.com"}
          aria-label="Email address to share with"
          autoComplete="off"
          onKeyDown={onKeyDown}
          onChange={(event) => setDraft(event.target.value)}
        />

        {state.kind === "found" && (
          <button
            type="button"
            className="share-add"
            disabled={disabled}
            onClick={commit}
          >
            <Icon name="plus" size={14} strokeWidth={2.2} />
            Add
          </button>
        )}
      </div>

      {error ? (
        <p className="share-status share-status--bad">
          <Icon name="alert" size={13} />
          {error}
        </p>
      ) : (
        message && (
          <p className={`share-status share-status--${current.tone}`}>
            <Icon
              name={
                state.kind === "checking"
                  ? "spinner"
                  : state.kind === "found"
                    ? "check"
                    : "alert"
              }
              size={13}
              strokeWidth={2}
              className={state.kind === "checking" ? "spin" : undefined}
            />
            {message}
          </p>
        )
      )}
    </div>
  );
};

export default ShareEmails;
