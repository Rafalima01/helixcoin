export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  /** Revoke every other session once the password changes — opt-in per the "opcional" requirement. */
  revokeOtherSessions?: boolean;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface ConfirmPasswordResetInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
}
