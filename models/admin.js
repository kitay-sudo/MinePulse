import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  password: { type: String, required: true }, // hash or plain for now
  createdAt: { type: Date, default: Date.now }
});

const AdminModel = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
export default AdminModel;
