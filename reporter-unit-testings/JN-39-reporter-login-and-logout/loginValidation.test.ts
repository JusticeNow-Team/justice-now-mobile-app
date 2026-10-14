import {
  hasLoginErrors,
  validateReporterLogin,
} from "../../src/reporter/login/validation";

describe("JN-39 Reporter login - form validation", () => {
  it("accepts a valid email and password", () => {
    const errors = validateReporterLogin({
      email: "reporter@example.com",
      password: "anything",
    });

    expect(errors).toEqual({});
    expect(hasLoginErrors(errors)).toBe(false);
  });

  it("requires both the email and password", () => {
    const errors = validateReporterLogin({ email: "", password: "" });

    expect(errors).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
    expect(hasLoginErrors(errors)).toBe(true);
  });

  it("treats a whitespace-only email as missing", () => {
    expect(validateReporterLogin({ email: "   ", password: "x" }).email).toBe(
      "Enter your email address.",
    );
  });

  it.each(["reporter", "reporter@", "reporter@example", "a b@example.com"])(
    "rejects the invalid email %p",
    (email) => {
      expect(validateReporterLogin({ email, password: "x" }).email).toBe(
        "Enter a valid email address.",
      );
    },
  );

  it("accepts an email with surrounding spaces", () => {
    expect(
      validateReporterLogin({ email: "  reporter@example.com ", password: "x" }),
    ).toEqual({});
  });

  it("does not trim or apply strength rules to the login password", () => {
    expect(validateReporterLogin({ email: "a@b.co", password: " " })).toEqual({});
  });
});
