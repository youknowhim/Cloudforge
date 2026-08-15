import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import Icon from "../../components/Icon/Icon";
import Loader from "../../components/Loader/Loader";

import AuthLayout from "./AuthLayout";
import PasswordField from "./PasswordField";

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Strong"];

const scorePassword = (password: string): number => {
  if (password.length < 8) return 0;

  let score = 1;

  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 14) score++;

  return Math.min(score, 3);
};

const Signup = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);

  const validate = () => {
    const errors: typeof fieldErrors = {};

    if (!name.trim()) errors.name = "Tell us what to call you.";
    else if (name.trim().length < 2) errors.name = "That name looks too short.";

    if (!email.trim()) errors.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      errors.email = "That doesn't look like a valid email.";

    if (password.length < 8)
      errors.password = "Use at least 8 characters.";

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setFormError("");

    if (!validate()) return;

    try {
      setSubmitting(true);

      await register({ name, email, password });

      navigate("/files", { replace: true });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "We couldn't create your account. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your CloudForge account"
      subtitle="Takes a minute. Whatever you add stays private until you decide to share it."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="alert alert--error" role="alert">
            <Icon name="alert" size={16} />
            <span>{formError}</span>
          </div>
        )}

        <div className="field">
          <label htmlFor="signup-name">Full name</label>

          <div className="input-affix">
            <span className="input-affix-icon">
              <Icon name="user" size={16} />
            </span>

            <input
              id="signup-name"
              className={`input input--with-icon${
                fieldErrors.name ? " input--error" : ""
              }`}
              value={name}
              disabled={submitting}
              autoComplete="name"
              placeholder="Ada Lovelace"
              aria-invalid={Boolean(fieldErrors.name)}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {fieldErrors.name && (
            <span className="field-error">{fieldErrors.name}</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="signup-email">Email</label>

          <div className="input-affix">
            <span className="input-affix-icon">
              <Icon name="mail" size={16} />
            </span>

            <input
              id="signup-email"
              className={`input input--with-icon${
                fieldErrors.email ? " input--error" : ""
              }`}
              type="email"
              value={email}
              disabled={submitting}
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={Boolean(fieldErrors.email)}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {fieldErrors.email && (
            <span className="field-error">{fieldErrors.email}</span>
          )}
        </div>

        <div className="signup-password">
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            disabled={submitting}
            error={fieldErrors.password}
            autoComplete="new-password"
            hint={password ? undefined : "At least 8 characters."}
          />

          {password && (
            <div className="strength" data-score={strength}>
              <div className="strength-bars">
                {[0, 1, 2].map((index) => (
                  <span key={index} data-on={index < strength} />
                ))}
              </div>

              <span className="strength-label">
                {STRENGTH_LABELS[strength]}
              </span>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--lg btn--block"
          disabled={submitting}
        >
          {submitting ? (
            <Loader text="Creating account" size={16} />
          ) : (
            "Create account"
          )}
        </button>

        <p className="auth-legal">
          By creating an account you agree to keep what you upload appropriate
          for the people you share it with.
        </p>
      </form>
    </AuthLayout>
  );
};

export default Signup;
