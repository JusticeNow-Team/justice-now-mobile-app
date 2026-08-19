export interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type ChangePasswordField =
  | "currentPassword"
  | "newPassword"
  | "confirmPassword";

export type ChangePasswordErrors = Partial<Record<ChangePasswordField, string>>;

export function getPasswordRules(password: string, currentPassword: string) {
  return [
    {
      label: "At least 10 characters",
      met: password.length >= 10,
    },
    {
      label: "Contains a number",
      met: /\d/.test(password),
    },
    {
      label: "Contains an uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      label: "Different from your current password",
      met:
        password.length > 0 &&
        currentPassword.length > 0 &&
        password !== currentPassword,
    },
  ];
}

export function validateChangePassword(
  values: ChangePasswordValues
): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};

  if (!values.currentPassword) {
    errors.currentPassword = "Enter your current password.";
  }

  if (!values.newPassword) {
    errors.newPassword = "Enter a new password.";
  } else if (values.newPassword.length < 10) {
    errors.newPassword = "Use at least 10 characters, including a number.";
  } else if (!/\d/.test(values.newPassword)) {
    errors.newPassword = "Include at least one number in your password.";
  } else if (!/[A-Z]/.test(values.newPassword)) {
    errors.newPassword = "Include at least one uppercase letter.";
  } else if (
    values.currentPassword &&
    values.newPassword === values.currentPassword
  ) {
    errors.newPassword = "Choose a password that is different from your current one.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Re-enter the new password.";
  } else if (values.newPassword !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match yet.";
  }

  return errors;
}

export function hasChangePasswordErrors(errors: ChangePasswordErrors) {
  return Object.keys(errors).length > 0;
}
