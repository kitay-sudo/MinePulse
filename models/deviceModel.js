import mongoose from 'mongoose';

const deviceModelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  consumption: { type: Number, required: true }
});

export default mongoose.model('DeviceModel', deviceModelSchema); 