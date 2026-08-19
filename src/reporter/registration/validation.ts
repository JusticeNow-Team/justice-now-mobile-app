export interface ReporterRegistrationValues {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  confirmPassword: string;
  language: string;
  acceptTerms: boolean;
  allowContact: boolean;
}

export type RegistrationField =
  | "fullName"
  | "email"
  | "mobile"
  | "password"
  | "confirmPassword"
  | "acceptTerms";

export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function phoneDigitCount(value: string) {
  return value.replace(/\D/g, "").length;
}

export function validateReporterRegistration(
  values: ReporterRegistrationValues
): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const fullName = values.fullName.trim();
  const email = values.email.trim();
  const mobile = values.mobile.trim();

  if (!fullName) {
    errors.fullName = "Enter your full name.";
  }

  if (!email) {
    errors.email = "Enter your email address.";
  } else if (!emailPattern.test(email.toLowerCase())) {
    errors.email = "Enter a valid email address.";
  }

  if (!mobile) {
    errors.mobile = "Enter your mobile number.";
  } else if (phoneDigitCount(mobile) < 9) {
    errors.mobile = "Enter a valid mobile number, for example +94 7X XXX XXXX.";
  }

  if (!values.password) {
    errors.password = "Create a password.";
  } else if (values.password.length < 10) {
    errors.password = "Use at least 10 characters, including a number.";
  } else if (!/\d/.test(values.password)) {
    errors.password = "Include at least one number in your password.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Re-enter your password.";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match yet.";
  }

  if (!values.acceptTerms) {
    errors.acceptTerms =
      "Accept the privacy policy and terms of use to create an account.";
  }

  return errors;
}

export function hasRegistrationErrors(errors: RegistrationErrors) {
  return Object.keys(errors).length > 0;
}
