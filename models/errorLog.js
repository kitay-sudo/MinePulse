import mongoose from 'mongoose';

const errorLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  message: { type: String, required: true }
});

const ErrorLog = mongoose.models.ErrorLog || mongoose.model('ErrorLog', errorLogSchema);
export default ErrorLog; 