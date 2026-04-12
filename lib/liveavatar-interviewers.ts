/** LiveAvatar `avatar_id` values for technical interview hosts (server + client). */
export const LIVEAVATAR_INTERVIEWER_IDS = {
  /** Default male presenter (existing project avatar) */
  male: "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a",
  /** Female Asian interviewer */
  female: "5dd4d830-957a-419f-9334-0dc4399ada5d",
} as const;

export type LiveavatarInterviewerGender = keyof typeof LIVEAVATAR_INTERVIEWER_IDS;

export function resolveInterviewerAvatarId(
  gender: string | undefined
): (typeof LIVEAVATAR_INTERVIEWER_IDS)[LiveavatarInterviewerGender] | null {
  if (gender === "male" || gender === "female") {
    return LIVEAVATAR_INTERVIEWER_IDS[gender];
  }
  return null;
}
