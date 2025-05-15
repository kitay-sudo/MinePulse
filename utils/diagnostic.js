import mongoose from 'mongoose';
import 'dotenv/config';
import DeviceModel from '../models/device.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mirra_ping';

// Функция для вывода всех устройств из базы данных
async function listAllDevices() {
  try {
    console.log('Подключение к MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Успешное подключение к MongoDB!');
    
    // Получаем все устройства
    const devices = await DeviceModel.find();
    
    console.log(`\n===== ВСЕГО УСТРОЙСТВ В БАЗЕ: ${devices.length} =====\n`);
    
    if (devices.length === 0) {
      console.log('В базе данных нет устройств.');
    } else {
      // Выводим детальную информацию о каждом устройстве
      devices.forEach((device, index) => {
        console.log(`\n[${index + 1}] Устройство: ${device.name || 'Без имени'}`);
        console.log(`    ID: ${device._id}`);
        console.log(`    IP: ${device.ip}`);
        console.log(`    Статус: ${device.status}`);
        console.log(`    Опрос включен: ${device.enablePolling ? 'ДА' : 'НЕТ'} <=== ВАЖНО!`);
        console.log(`    В ремонте: ${device.inRepair ? 'ДА' : 'НЕТ'}`);
        console.log(`    Последняя проверка: ${device.lastChecked ? device.lastChecked.toLocaleString() : 'Никогда'}`);
        
        // Выводим информацию о последних событиях
        if (device.events && device.events.length > 0) {
          const lastEvent = device.events[device.events.length - 1];
          console.log(`    Последнее событие: ${lastEvent.timestamp.toLocaleString()} - ${lastEvent.status === 0 ? 'Online' : 'Offline'}`);
          console.log(`    Всего событий: ${device.events.length}`);
        } else {
          console.log(`    События: Нет событий`);
        }
      });
    }
    
    // Отдельно выводим устройства с отключенным опросом
    const disabledPolling = devices.filter(d => !d.enablePolling);
    if (disabledPolling.length > 0) {
      console.log(`\n\n===== УСТРОЙСТВА С ОТКЛЮЧЕННЫМ ОПРОСОМ (${disabledPolling.length}) =====`);
      disabledPolling.forEach(device => {
        console.log(`    ${device.ip} (${device.name || 'Без имени'})`);
      });
    }
    
    // Отдельно выводим устройства в ремонте
    const inRepair = devices.filter(d => d.inRepair);
    if (inRepair.length > 0) {
      console.log(`\n\n===== УСТРОЙСТВА В РЕМОНТЕ (${inRepair.length}) =====`);
      inRepair.forEach(device => {
        console.log(`    ${device.ip} (${device.name || 'Без имени'})`);
      });
    }
    
  } catch (error) {
    console.error('Ошибка при получении устройств:', error);
  } finally {
    // Закрываем соединение с базой данных
    await mongoose.connection.close();
    console.log('\nСоединение с MongoDB закрыто.');
  }
}

// Запускаем функцию
listAllDevices(); 