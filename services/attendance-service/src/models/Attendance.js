// `attendances` collection (hr_attendance DB). One record per user per day.
import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" - makes "one record per day" easy to enforce
    clockIn: { type: Date, required: true },
    clockOut: { type: Date },
    totalHours: { type: Number, default: 0 }, // set on clock-out
    overtimeHours: { type: Number, default: 0 }, // totalHours - STANDARD_WORK_HOURS (min 0)
    status: { type: String, enum: ['present', 'late', 'incomplete'], default: 'incomplete' }, // incomplete = no clock-out yet
    workLog: { type: String, default: '' }, // what the employee worked on (sent on clock-out)
    correctedBy: { type: String }, // reserved: userId of HR who manually fixed the record (optional feature)
  },
  { timestamps: true },
);

// Guarantees no duplicate day per user, even under concurrent requests.
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
