export const reporterLanguages = [
  { code: "en", label: "English (English)" },
  { code: "si", label: "සිංහල (Sinhala)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
] as const;

export type ReporterLanguageCode =
  (typeof reporterLanguages)[number]["code"];
