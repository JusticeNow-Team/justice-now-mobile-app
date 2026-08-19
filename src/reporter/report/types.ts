export type ReportingMode = "identified" | "anonymous";
export type OngoingStatus = "yes" | "no" | "unsure";
export type VictimRelation = "self" | "other";
export type ContactMethod = "app" | "phone" | "email";

export interface WitnessDraft {
  name: string;
  contact: string;
  seen: string;
}

export interface CaseDraft {
  reportingMode: ReportingMode;
  categories: string[];
  title: string;
  description: string;
  incidentDate: string;
  incidentTime: string;
  ongoing: OngoingStatus | "";
  province: string;
  district: string;
  city: string;
  specificLocation: string;
  hideExactLocation: boolean;
  victimRelation: VictimRelation | "";
  victimName: string;
  victimAge: string;
  victimGender: string;
  victimContact: string;
  victimRelationship: string;
  witnesses: WitnessDraft[];
  hideIdentity: boolean;
  allowContact: boolean;
  discreetNotifications: boolean;
  stripLocationData: boolean;
  contactMethod: ContactMethod;
}

export const initialCaseDraft: CaseDraft = {
  reportingMode: "identified",
  categories: [],
  title: "",
  description: "",
  incidentDate: "",
  incidentTime: "",
  ongoing: "",
  province: "Western Province",
  district: "Colombo",
  city: "",
  specificLocation: "",
  hideExactLocation: false,
  victimRelation: "",
  victimName: "",
  victimAge: "Not known",
  victimGender: "Prefer not to say",
  victimContact: "",
  victimRelationship: "",
  witnesses: [],
  hideIdentity: true,
  allowContact: true,
  discreetNotifications: true,
  stripLocationData: false,
  contactMethod: "app",
};

export interface SubmittedCase {
  id: string;
  caseReference: string;
  submittedAt: string;
  reportingMode: ReportingMode;
}
