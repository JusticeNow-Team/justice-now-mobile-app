import {
  getPasswordRules,
  hasChangePasswordErrors,
  validateChangePassword,
} from "../../src/reporter/password/validation";

describe("JN-59 Change password - live password rules", () => {
  it("marks every rule as met for a strong, different password", () => {
    expect(getPasswordRules("NewSecure2026", "OldSecure2025")).toEqual([
      { label: "At least 10 characters", met: true },
      { label: "Contains a number", met: true },
      { label: "Contains an uppercase letter", met: true },
      { label: "Different from your current password", met: true },
    ]);
  });

  it("marks every rule as unmet for an empty password", () => {
    expect(getPasswordRules("", "OldSecure2025").every((rule) => !rule.met)).toBe(true);
  });

  it("flags a new password that matches the current one", () => {
    const rules = getPasswordRules("SamePass2026", "SamePass2026");

    expect(rules[3]).toEqual({ label: "Different from your current password", met: false });
  });

  it("does not mark 'different' as met until the current password is typed", () => {
    expect(getPasswordRules("NewSecure2026", "")[3].met).toBe(false);
  });

  it("evaluates each rule independently", () => {
    const [length, number, uppercase] = getPasswordRules("lowercaseonly", "x");

    expect(length.met).toBe(true);
    expect(number.met).toBe(false);
    expect(uppercase.met).toBe(false);
  });
});

describe("JN-59 Change password - form validation", () => {
  const valid = {
    currentPassword: "OldSecure2025",
    newPassword: "NewSecure2026",
    confirmPassword: "NewSecure2026",
  };

  it("accepts a valid change request", () => {
    const errors = validateChangePassword(valid);

    expect(errors).toEqual({});
    expect(hasChangePasswordErrors(errors)).toBe(false);
  });

  it("requires all three fields", () => {
    const errors = validateChangePassword({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    expect(errors).toEqual({
      currentPassword: "Enter your current password.",
      newPassword: "Enter a new password.",
      confirmPassword: "Re-enter the new password.",
    });
    expect(hasChangePasswordErrors(errors)).toBe(true);
  });

  it.each([
    ["Short1A", "Use at least 10 characters, including a number."],
    ["NoNumbersHere", "Include at least one number in your password."],
    ["lowercase2026", "Include at least one uppercase letter."],
    ["OldSecure2025", "Choose a password that is different from your current one."],
  ])("rejects the new password %p", (newPassword, message) => {
    const errors = validateChangePassword({
      ...valid,
      newPassword,
      confirmPassword: newPassword,
    });

    expect(errors.newPassword).toBe(message);
  });

  it("rejects a confirmation that does not match", () => {
    expect(
      validateChangePassword({ ...valid, confirmPassword: "NewSecure2027" }).confirmPassword,
    ).toBe("Passwords do not match yet.");
  });
});
