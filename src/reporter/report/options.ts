export const reportSteps = [
  { n: 1, path: "/reporter/report/preference", label: "Reporting preference" },
  { n: 2, path: "/reporter/report/category", label: "Incident category" },
  { n: 3, path: "/reporter/report/details", label: "Incident details" },
  { n: 4, path: "/reporter/report/location", label: "Location" },
  { n: 5, path: "/reporter/report/victim", label: "Affected person" },
  { n: 6, path: "/reporter/report/witness", label: "Witnesses" },
  { n: 7, path: "/reporter/report/evidence", label: "Evidence" },
  { n: 8, path: "/reporter/report/privacy", label: "Privacy" },
  { n: 9, path: "/reporter/report/review", label: "Review" },
] as const;

export const incidentCategories = [
  { id: "unlawful_detention", label: "Unlawful detention", hint: "Being held without lawful reason or process" },
  { id: "discrimination", label: "Discrimination", hint: "Unfair treatment based on who you are" },
  { id: "violence_or_abuse", label: "Violence or abuse", hint: "Physical harm, threats or ill-treatment" },
  { id: "harassment", label: "Harassment", hint: "Repeated unwanted behaviour or intimidation" },
  { id: "freedom_of_expression", label: "Freedom of expression violation", hint: "Being stopped from speaking or assembling" },
  { id: "workplace_rights", label: "Workplace rights violation", hint: "Unsafe, unpaid or unfair working conditions" },
  { id: "child_rights", label: "Child rights violation", hint: "Harm or denial of rights affecting a child" },
  { id: "other", label: "Other", hint: "Something not listed here" },
];

export const provinces = [
  "Western Province",
  "Central Province",
  "Southern Province",
  "Northern Province",
  "Eastern Province",
  "North Western Province",
  "North Central Province",
  "Uva Province",
  "Sabaragamuwa Province",
];

export const districts = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Galle",
  "Batticaloa",
  "Jaffna",
];

export const ageOptions = [
  "Under 12",
  "12–17",
  "18–24",
  "25–30",
  "30–35",
  "36–50",
  "Over 50",
  "Not known",
];

export const genderOptions = [
  "Female",
  "Male",
  "Non-binary",
  "Prefer not to say",
  "Not known",
];
