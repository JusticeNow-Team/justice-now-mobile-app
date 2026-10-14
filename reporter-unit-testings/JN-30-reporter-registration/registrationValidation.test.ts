import { reporterLanguages } from "../../src/reporter/registration/languages";
import {
  hasRegistrationErrors,
  ReporterRegistrationValues,
  validateReporterRegistration,
} from "../../src/reporter/registration/validation";

function validForm(
  overrides: Partial<ReporterRegistrationValues> = {},
): ReporterRegistrationValues {
  return {
    fullName: "Nimali Perera",
    email: "nimali@example.com",
    mobile: "+94 77 123 4567",
    password: "SafePass2026",
    confirmPassword: "SafePass2026",
    language: "en",
    acceptTerms: true,
    allowContact: true,
    ...overrides,
  };
}

describe("JN-30 Reporter registration - form validation", () => {
  it("accepts a fully valid registration form", () => {
    const errors = validateReporterRegistration(validForm());

    expect(errors).toEqual({});
    expect(hasRegistrationErrors(errors)).toBe(false);
  });

  it("reports every required field when the form is empty", () => {
    const errors = validateReporterRegistration(
      validForm({
        fullName: "",
        email: "",
        mobile: "",
        password: "",
        confirmPassword: "",
        acceptTerms: false,
      }),
    );

    expect(errors).toEqual({
      fullName: "Enter your full name.",
      email: "Enter your email address.",
      mobile: "Enter your mobile number.",
      password: "Create a password.",
      confirmPassword: "Re-enter your password.",
      acceptTerms:
        "Accept the privacy policy and terms of use to create an account.",
    });
    expect(hasRegistrationErrors(errors)).toBe(true);
  });

  it("treats whitespace-only name, email and mobile as missing", () => {
    const errors = validateReporterRegistration(
      validForm({ fullName: "   ", email: "  ", mobile: "  " }),
    );

    expect(errors.fullName).toBe("Enter your full name.");
    expect(errors.email).toBe("Enter your email address.");
    expect(errors.mobile).toBe("Enter your mobile number.");
  });

  it.each(["nimali", "nimali@", "nimali@example", "nim ali@example.com", "@example.com"])(
    "rejects the invalid email %p",
    (email) => {
      expect(validateReporterRegistration(validForm({ email })).email).toBe(
        "Enter a valid email address.",
      );
    },
  );

  it("accepts an email surrounded by spaces and in upper case", () => {
    const errors = validateReporterRegistration(
      validForm({ email: "  NIMALI@Example.COM  " }),
    );

    expect(errors.email).toBeUndefined();
  });

  it("rejects a mobile number with fewer than 9 digits", () => {
    expect(validateReporterRegistration(validForm({ mobile: "+94 77 12" })).mobile).toBe(
      "Enter a valid mobile number, for example +94 7X XXX XXXX.",
    );
  });

  it("counts only digits in the mobile number, ignoring spaces and symbols", () => {
    expect(
      validateReporterRegistration(validForm({ mobile: "(077) 123-456" })).mobile,
    ).toBeUndefined();
  });

  it("rejects a password shorter than 10 characters", () => {
    const errors = validateReporterRegistration(
      validForm({ password: "Short1", confirmPassword: "Short1" }),
    );

    expect(errors.password).toBe("Use at least 10 characters, including a number.");
  });

  it("rejects a password without a number", () => {
    const errors = validateReporterRegistration(
      validForm({ password: "NoNumbersHere", confirmPassword: "NoNumbersHere" }),
    );

    expect(errors.password).toBe("Include at least one number in your password.");
  });

  it("accepts a password of exactly 10 characters that contains a number", () => {
    const errors = validateReporterRegistration(
      validForm({ password: "abcdefghi1", confirmPassword: "abcdefghi1" }),
    );

    expect(errors.password).toBeUndefined();
  });

  it("rejects a confirmation that does not match the password", () => {
    const errors = validateReporterRegistration(
      validForm({ confirmPassword: "SafePass2027" }),
    );

    expect(errors.confirmPassword).toBe("Passwords do not match yet.");
  });

  it("requires the privacy policy and terms to be accepted", () => {
    const errors = validateReporterRegistration(validForm({ acceptTerms: false }));

    expect(errors).toEqual({
      acceptTerms:
        "Accept the privacy policy and terms of use to create an account.",
    });
  });

  it("does not require the optional case-contact consent", () => {
    expect(
      validateReporterRegistration(validForm({ allowContact: false })),
    ).toEqual({});
  });
});

describe("JN-30 Reporter registration - language options", () => {
  it("offers English, Sinhala and Tamil", () => {
    expect(reporterLanguages.map((language) => language.code)).toEqual([
      "en",
      "si",
      "ta",
    ]);
  });
});
