import { maskEmail, profileInitials } from "../../src/reporter/profile/types";
import {
  hasProfileErrors,
  validateReporterProfile,
} from "../../src/reporter/profile/validation";

describe("JN-50 Reporter profile - form validation", () => {
  const valid = {
    fullName: "Nimali Perera",
    email: "nimali@example.com",
    phone: "+94 77 123 4567",
  };

  it("accepts a valid profile", () => {
    const errors = validateReporterProfile(valid);

    expect(errors).toEqual({});
    expect(hasProfileErrors(errors)).toBe(false);
  });

  it("requires name, email and phone", () => {
    const errors = validateReporterProfile({ fullName: " ", email: "", phone: "" });

    expect(errors).toEqual({
      fullName: "Enter your full name.",
      email: "Your account email is missing.",
      phone: "Enter your mobile number.",
    });
    expect(hasProfileErrors(errors)).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(validateReporterProfile({ ...valid, email: "nimali@" }).email).toBe(
      "Enter a valid email address.",
    );
  });

  it("rejects a phone number with fewer than 9 digits", () => {
    expect(validateReporterProfile({ ...valid, phone: "077 123" }).phone).toBe(
      "Enter a valid mobile number, for example +94 7X XXX XXXX.",
    );
  });

  it("accepts a phone number with exactly 9 digits", () => {
    expect(validateReporterProfile({ ...valid, phone: "771234567" }).phone).toBeUndefined();
  });
});

describe("JN-50 Reporter profile - display helpers", () => {
  it.each([
    ["nimali@example.com", "n•••••i@example.com"],
    ["ab@example.com", "a•••••@example.com"],
    ["a@example.com", "a•••••@example.com"],
  ])("masks %p as %p", (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });

  it("returns values that are not emails unchanged", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
    expect(maskEmail("")).toBe("");
  });

  it.each([
    ["Nimali Perera", "NP"],
    ["  nimali   kumari  perera ", "NP"],
    ["Nimali", "NI"],
    ["", "R"],
    ["   ", "R"],
  ])("builds initials for %p as %p", (name, initials) => {
    expect(profileInitials(name)).toBe(initials);
  });
});
