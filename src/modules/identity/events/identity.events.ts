export const IDENTITY_EVENTS = {
  userRegistered: "identity.user.registered",
  loginSuccess: "identity.user.login.success",
  loginFailed: "identity.user.login.failed",
  logout: "identity.user.logout",
  passwordChanged: "identity.user.password.changed",
  passwordResetRequested: "identity.user.password.reset_requested",
  passwordResetCompleted: "identity.user.password.reset_completed",
  emailVerificationRequested: "identity.user.email.verification_requested",
  emailVerified: "identity.user.email.verified",
  userBlocked: "identity.user.blocked",
  userUnblocked: "identity.user.unblocked",
  userSoftDeleted: "identity.user.deleted",
  userRestored: "identity.user.restored",
  sessionCreated: "identity.session.created",
  sessionRevoked: "identity.session.revoked",
} as const;

export interface UserEventPayload {
  userId: string;
}

export interface SessionEventPayload {
  userId: string;
  sessionId: string;
}
