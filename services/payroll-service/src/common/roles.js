// The three roles of the system. Values are stored in the users collection and in the JWT.
export const ROLES = {
  EMPLOYEE: 'employee',
  HR: 'hr_manager',
  ADMIN: 'admin',
};

export const ALL_ROLES = Object.values(ROLES);
export const STAFF = [ROLES.HR, ROLES.ADMIN]; // "HR or Admin" shortcut used in many routes

export const isStaff = (user) => !!user && STAFF.includes(user.role);
