// The only User fields API responses may expose. Including a user relation with
// `: true` serializes the full row — passwordHash included — into client JSON.
// Always use `{ select: safeUserSelect }` on assignee/createdBy/author/user.
export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
} as const;
