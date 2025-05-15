import mongoose from 'mongoose';

const downtimeSchema = new mongoose.Schema({
  worker: { type: String, required: true },
  ip: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: Number, enum: [0, 1], required: true } // 0 - online, 1 - offline
});

const DowntimeModel = mongoose.models.Downtime || mongoose.model('Downtime', downtimeSchema);
export default DowntimeModel; 