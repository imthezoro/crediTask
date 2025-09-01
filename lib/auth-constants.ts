// Shared authentication-related constants
// Centralizes reactivation block durations to avoid hard-coded values

export const REACTIVATION_BLOCK = {
  // Temporary self-deactivation via /api/account/deactivate
  // Previously: 24 hours
  deactivationHours: 24,

  // Admin-driven suspension via /api/admin/users/[id]
  // Previously: 30 days
  suspensionDays: 30,

  // Hard delete email blocking duration (default)
  hardDeleteDays: 7,
} as const
