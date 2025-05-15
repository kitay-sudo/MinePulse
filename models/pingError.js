import mongoose from 'mongoose';

const errorSchema = new mongoose.Schema({
  ip: String,
  error: String,
  worker: String,
  timestamp: Date
});

const PingErrorModel = mongoose.models.PingError || mongoose.model('PingError', errorSchema);
export default PingErrorModel;
