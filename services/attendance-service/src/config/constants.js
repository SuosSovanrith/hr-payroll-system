// Business rules for time tracking - change here, not inside controllers.
export const STANDARD_WORK_HOURS = 8; // hours beyond this per day count as overtime
export const LATE_AFTER_HOUR = 9; // clock-in at or after 09:00 (WORK_TIMEZONE) => status "late"

export const WORK_TIMEZONE = 'Asia/Phnom_Penh'; // used to decide "today" and the late cutoff
