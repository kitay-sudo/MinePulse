import mongoose from 'mongoose';
const InvoiceSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientFio: String,
  amount: Number,
  status: { type: String, enum: ['На оплате', 'Оплачен'], default: 'На оплате' },
  periodFrom: Date,
  periodTo: Date,
  totalDowntime: Number,
  details: [
    {
      worker: String,
      serialNumber: String,
      consumption: Number,
      minutesWorked: Number,
      minutesDowntime: Number,
      amount: Number
    }
  ]
}, { timestamps: { createdAt: 'createdAt' } });
export default mongoose.model('Invoice', InvoiceSchema); 