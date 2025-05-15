import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  telegramToken: { type: String, default: '' },
  telegramChatId: { type: String, default: '' },
  telegramEnabled: { type: Boolean, default: false },
  telegramInitialized: { type: Boolean, default: false },
  theme: { type: String, enum: ['blue', 'purple'], default: 'blue' },
  serverAddress: { type: String, default: '' },
  monitoringEnabled: { type: Boolean, default: true },
  monitoringLastUpdate: Date,
  macToIpEnabled: { type: Boolean, default: true }
});

const SettingsModel = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
export default SettingsModel;
