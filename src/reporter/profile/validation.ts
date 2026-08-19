export interface ReporterProfileValues {
  fullName: string;
  email: string;
  phone: string;
}

export type ProfileField = "fullName" | "email" | "phone";

export type ProfileErrors = Partial<Record<ProfileField, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function phoneDigitCount(value: string) {
  return value.replace(/\D/g, "").length;
}

export function validateReporterProfile(
  values: ReporterProfileValues
): ProfileErrors {
  const errors: ProfileErrors = {};
  const fullName = values.fullName.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();

  if (!fullName) {
    errors.fullName = "Enter your full name.";
  }

  if (!email) {
    errors.email = "Your account email is missing.";
  } else if (!emailPattern.test(email.toLowerCase())) {
    errors.email = "Enter a valid email address.";
  }

  if (!phone) {
    errors.phone = "Enter your mobile number.";
  } else if (phoneDigitCount(phone) < 9) {
    errors.phone =
      "Enter a valid mobile number, for example +94 7X XXX XXXX.";
  }

  return errors;
}

export function hasProfileErrors(errors: ProfileErrors) {
  return Object.keys(errors).length > 0;
}
