import { ReporterLanguageCode } from "../registration/languages";

export interface ReporterProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  preferredLanguage: ReporterLanguageCode;
  allowCaseContact: boolean;
  role: string;
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return email;
  }

  if (local.length <= 2) {
    return `${local[0] ?? ""}•••••@${domain}`;
  }

  return `${local[0]}•••••${local[local.length - 1]}@${domain}`;
}

export function profileInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "R";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
