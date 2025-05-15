import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  ip: { type: String, default: '' },
  name: String,
  mac: { type: String, default: '' },
  serialNumber: { type: String, default: '' },
  worker: { type: String, default: '' },
  consumption: { type: Number, default: 0 },
  model: { type: String, default: '' },
  cards: { type: Number, default: 0 }, // Количество рабочих карт
  comment: { type: String, default: '' },
  inRepair: { type: Boolean, default: false },
  enablePolling: { type: Boolean, default: true },
  status: { type: String, enum: ['online', 'offline'], default: 'offline' },
  lastOnline: Date,
  lastChecked: Date,
  alert: { type: String, default: '' }, // Ошибка при сканировании
  events: [
    {
      timestamp: Date,
      status: { type: Number, enum: [0, 1] }, // 0 - online, 1 - offline
      type: { type: String, enum: ['status', 'repair'], default: 'status' } // тип события
    }
  ],
  lastAlertedOfflineAt: Date // если не null — алерт уже отправлен
});

const DeviceModel = mongoose.models.Device || mongoose.model('Device', deviceSchema);
export default DeviceModel;
