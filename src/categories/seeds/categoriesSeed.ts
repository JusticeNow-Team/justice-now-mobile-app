import { ReportCategory } from "../types";

export const INITIAL_REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "cat_unlawful_detention",
    code: "unlawful_detention",
    name: "Unlawful Detention",
    description:
      "Being held in custody, arrested, or detained without lawful authority, due process, or judicial review.",
    hint: "Being held without lawful reason or process",
    icon: "⛓️",
    isActive: true,
    displayOrder: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_discrimination",
    code: "discrimination",
    name: "Discrimination",
    description:
      "Unfair treatment or denial of rights based on ethnicity, religion, gender, sexual orientation, disability, or social status.",
    hint: "Unfair treatment based on who you are",
    icon: "⚖️",
    isActive: true,
    displayOrder: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_violence_abuse",
    code: "violence_or_abuse",
    name: "Violence or Abuse",
    description:
      "Physical assault, excessive use of force by authorities, torture, cruel, inhuman, or degrading treatment.",
    hint: "Physical harm, threats or ill-treatment",
    icon: "🛡️",
    isActive: true,
    displayOrder: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_harassment",
    code: "harassment",
    name: "Harassment & Intimidation",
    description:
      "Repeated stalking, digital harassment, surveillance, extortion, or threats aimed at silencing individuals.",
    hint: "Repeated unwanted behaviour or intimidation",
    icon: "⚠️",
    isActive: true,
    displayOrder: 4,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_freedom_expression",
    code: "freedom_of_expression",
    name: "Freedom of Expression Violation",
    description:
      "Suppression of free speech, peaceful assembly, press freedom, censorship, or unlawful confiscation of reporting equipment.",
    hint: "Being stopped from speaking or assembling",
    icon: "📢",
    isActive: true,
    displayOrder: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_workplace_rights",
    code: "workplace_rights",
    name: "Workplace Rights Violation",
    description:
      "Forced labor, hazardous working conditions, withholding of wages, union busting, or child labor.",
    hint: "Unsafe, unpaid or unfair working conditions",
    icon: "🏭",
    isActive: true,
    displayOrder: 6,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_child_rights",
    code: "child_rights",
    name: "Child Rights Violation",
    description:
      "Harm, exploitation, neglect, denial of education, or abuse affecting minors and children.",
    hint: "Harm or denial of rights affecting a child",
    icon: "🧸",
    isActive: true,
    displayOrder: 7,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_gender_based_violence",
    code: "gender_based_violence",
    name: "Gender-Based Violence",
    description:
      "Violence, assault, coercive control, or domestic abuse inflicted against individuals based on gender identity.",
    hint: "Harm or abuse directed against a person based on gender",
    icon: "💜",
    isActive: true,
    displayOrder: 8,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_health_basic_services",
    code: "health_basic_services",
    name: "Right to Health & Basic Services",
    description:
      "Denial of emergency medical care, clean water, essential shelter, or discriminatory access to public relief.",
    hint: "Deprivation of essential healthcare, water, or shelter",
    icon: "🏥",
    isActive: true,
    displayOrder: 9,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat_other",
    code: "other",
    name: "Other Human Rights Violation",
    description:
      "Other incidents or rights violations not specifically listed in the predefined categories above.",
    hint: "Something not listed here",
    icon: "📋",
    isActive: true,
    displayOrder: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];
