// Business rules for time tracking - change here, not inside controllers.
export const STANDARD_WORK_HOURS = 8; // hours beyond this per day count as overtime
export const LATE_AFTER_HOUR = 9; // clock-in after 09:00 (server time) => status "late"
