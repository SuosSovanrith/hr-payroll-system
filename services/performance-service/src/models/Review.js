// `reviews` collection (hr_performance DB). One review per employee per period.
import mongoose from 'mongoose';

const rating = { type: Number, min: 1, max: 5, required: true }; // 1 (poor) .. 5 (excellent)

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true }, // the employee being reviewed
    reviewerId: { type: String, required: true }, // HR/Admin who wrote it (req.user.id)
    period: { type: String, required: true, trim: true }, // e.g. "2026-Q3" or "2026-H1"
    ratings: {
      quality: rating,
      productivity: rating,
      teamwork: rating,
      communication: rating,
    },
    overallRating: { type: Number, min: 1, max: 5 }, // average of the 4 ratings (computed in the controller)
    feedback: { type: String, trim: true },
    goals: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

reviewSchema.index({ userId: 1, period: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);
