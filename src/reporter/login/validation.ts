export interface ReporterLoginValues {
  email: string;
  password: string;
}

export type LoginField = "email" | "password";

export type LoginErrors = Partial<Record<LoginField, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateReporterLogin(
  values: ReporterLoginValues
): LoginErrors {
  const errors: LoginErrors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = "Enter your email address.";
  } else if (!emailPattern.test(email.toLowerCase())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Enter your password.";
  }

  return errors;
}

export function hasLoginErrors(errors: LoginErrors) {
  return Object.keys(errors).length > 0;
}
