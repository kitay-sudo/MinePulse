import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fio: { type: String, required: true },
  phone: { type: String, required: true },
  telegramId: { type: String, default: '' },
  tariff: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Клиент', 'Админ'], default: 'Клиент' },
  workers: { type: [String], default: [] },
  contractFile: { type: String, default: '' },
  archived: { type: Boolean, default: false }
});

export default mongoose.model('User', userSchema); 