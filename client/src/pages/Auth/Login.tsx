import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import Icon from "../../components/Icon/Icon";
import Loader from "../../components/Loader/Loader";

import AuthLayout from "./AuthLayout";
import PasswordField from "./PasswordField";

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? "/files";

  const validate = () => {
    const errors: typeof fieldErrors = {};

    if (!email.trim()) errors.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      errors.email = "That doesn't look like a valid email.";

    if (!password) errors.password = "Enter your password.";

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setFormError("");

    if (!validate()) return;

    try {
      setSubmitting(true);

      await signIn({ email, password });

      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Sign in failed. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to CloudForge"
      subtitle="Everything you've saved is right where you left it."
      footer={
        <>
          New to CloudForge? <Link to="/signup">Create an account</Link>
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
          <label htmlFor="login-email">Email</label>

          <div className="input-affix">
            <span className="input-affix-icon">
              <Icon name="mail" size={16} />
            </span>

            <input
              id="login-email"
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

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          disabled={submitting}
          error={fieldErrors.password}
          autoComplete="current-password"
        />

        <button
          type="submit"
          className="btn btn--primary btn--lg btn--block"
          disabled={submitting}
        >
          {submitting ? <Loader text="Signing in" size={16} /> : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Login;
