import mongoose from 'mongoose';
import 'dotenv/config';
import DeviceModel from '../models/device.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mirra_ping';

// Функция для вывода всех устройств из базы данных
async function listAllDevices() {
  try {
    await mongoose.connect(MONGO_URI);
    
    // Получаем все устройства
    const devices = await DeviceModel.find();
    
    
    if (devices.length === 0) {
    } else {
      // Выводим детальную информацию о каждом устройстве
      devices.forEach((device, index) => {
        
        // Выводим информацию о последних событиях
        if (device.events && device.events.length > 0) {
          const lastEvent = device.events[device.events.length - 1]; 
        } 
      });
    }
    
    // Отдельно выводим устройства с отключенным опросом
    const disabledPolling = devices.filter(d => !d.enablePolling);
    
    // Отдельно выводим устройства в ремонте
    const inRepair = devices.filter(d => d.inRepair);
    
  } catch (error) {
    console.error('Ошибка при получении устройств:', error);
  } finally {
    // Закрываем соединение с базой данных
    await mongoose.connection.close();
  }
}

// Запускаем функцию
listAllDevices(); 