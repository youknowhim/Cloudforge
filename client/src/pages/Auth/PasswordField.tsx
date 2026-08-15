import { useId, useState } from "react";

import Icon from "../../components/Icon/Icon";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
}

const PasswordField = ({
  label,
  value,
  onChange,
  disabled,
  error,
  autoComplete,
  hint,
}: PasswordFieldProps) => {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>

      <div className="input-affix">
        <input
          id={id}
          className={`input${error ? " input--error" : ""}`}
          type={visible ? "text" : "password"}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder="••••••••"
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
        />

        <button
          type="button"
          className="input-affix-button"
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={16} />
        </button>
      </div>

      {error ? (
        <span className="field-error">{error}</span>
      ) : (
        hint && <span className="hint">{hint}</span>
      )}
    </div>
  );
};

export default PasswordField;
