// Translated labels for values that come from the server.

// 'manager' -> 'esihenkilö'; unknown roles are shown as they are.
export const roleLabel = (t, role) => t(`roles.${role}`, { defaultValue: role })

// 'managerGroup' -> 'Manager'
export const groupLabel = (t, group) => t(`groups.${group}`, { defaultValue: group })
