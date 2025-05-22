import express from 'express';
import mongoose from 'mongoose';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import DeviceModel from './models/device.js';
import PingErrorModel from './models/pingError.js';
import SettingsModel from './models/settings.js';
import { testTelegramConnection, init as initTelegram, updateSettings as updateTelegramSettings, sendTelegramToUser } from './notifications/telegram.js';
import fetch from 'node-fetch';
import ping from 'ping';
import pLimit from 'p-limit';
import ErrorLog from './models/errorLog.js';
import DowntimeModel from './models/downtime.js';
import DeviceModelModel from './models/deviceModel.js';
import User from './models/user.js';
import Invoice from './models/invoice.js';
import { logger } from './utils/logger.js';

process.removeAllListeners('warning');
process.on('warning', e => {
  if (e.name === 'DeprecationWarning' && e.code === 'DEP0040') return;
  console.warn(e.stack);
});

// Инициализация настроек и пароля администратора в базе при старте
async function ensureSettingsAndAdmin() {
  // Settings
  let settings = await SettingsModel.findOne();
  if (!settings) {
    settings = await SettingsModel.create({
      autolockMinutes: parseInt(process.env.AUTOLOCK_MINUTES || '1', 10),
      telegramToken: process.env.TELEGRAM_TOKEN || '',
      telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
      telegramEnabled: process.env.TELEGRAM_ENABLED === 'true'
    });
    logger.info('Settings initialized from .env');
  } else {
    logger.info('Settings loaded from DB');
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.API_PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

app.use(express.json());
app.use(express.static('public'));

// Корневой маршрут
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Новый маршрут для Bootstrap-версии дашборда
app.get('/bootstrap', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard_bootstrap.html'));
});

// История простоев/онлайна по устройству
app.get('/api/devices/:ip/history', async (req, res) => {
  const { worker } = req.query;
  const device = await DeviceModel.findOne({ ip: req.params.ip });
  if (!device) return res.status(404).json({ error: 'Device not found' });
  
  let events = device.events;
  if (worker) {
    events = events.filter(e => e.worker === worker);
  }
  
  res.json(events);
});

// Отчет по простою за период
app.get('/api/report', async (req, res) => {
  const { from, to } = req.query;
  const fromDate = from ? new Date(from) : new Date(Date.now() - 24*60*60*1000);
  const toDate = to ? new Date(to) : new Date();
  const devices = await DeviceModel.find();
  const report = devices.map(device => {
    const events = device.events.filter(e => e.timestamp >= fromDate && e.timestamp <= toDate);
    const downtime = events.filter(e => e.status === 1).length;
    const percentOffline = events.length ? ((downtime / events.length) * 100).toFixed(1) : '0.0';
    return { ip: device.ip, downtimeMinutes: downtime, percentOffline };
  });
  res.json(report);
});

// Удаление одной ошибки
app.delete('/api/errors/:id', async (req, res) => {
  const id = req.params.id;
  // Пробуем удалить из PingErrorModel
  const result = await PingErrorModel.deleteOne({ _id: id });
  if (result.deletedCount > 0) return res.json({ success: true });
  // Если не найдено — пробуем удалить из ErrorLog
  const result2 = await ErrorLog.deleteOne({ _id: id });
  if (result2.deletedCount > 0) return res.json({ success: true });
  res.status(404).json({ success: false, error: 'Ошибка не найдена' });
});

// Удаление всех ошибок
app.delete('/api/errors', async (req, res) => {
  await PingErrorModel.deleteMany({});
  await ErrorLog.deleteMany({});
  res.json({ success: true });
});

// Просмотр ошибок
app.get('/api/errors', async (req, res) => {
  const { type, search } = req.query;
  const filter = {};
  // Если тип не указан или 'all', возвращаем ошибки пинга
  if (!type || type === 'all') {
    const pingFilter = {};
    if (search) pingFilter.error = { $regex: search, $options: 'i' };
    const errors = await PingErrorModel.find(pingFilter, { ip: 1, error: 1, worker: 1, timestamp: 1 });
    return res.json(errors);
  }
  // Иначе фильтруем по типу и поиску
  if (type) filter.type = type;
  if (search) filter.message = { $regex: search, $options: 'i' };
  const errors = await ErrorLog.find(filter)
    .sort({ timestamp: -1 })
    .limit(200);
  res.json(errors);
});

// API: Получить настройки (autolock, telegram)
app.get('/api/settings', async (req, res) => {
  const settings = await SettingsModel.findOne();
  res.json({
    autolockMinutes: settings?.autolockMinutes || 1,
    telegramToken: settings?.telegramToken || '',
    telegramChatId: settings?.telegramChatId || '',
    telegramEnabled: settings?.telegramEnabled || false,
    telegramInitialized: settings?.telegramInitialized || false,
    theme: settings?.theme || 'blue',
    serverAddress: settings?.serverAddress || '',
    monitoringEnabled: settings?.monitoringEnabled ?? true,
    monitoringLastUpdate: settings?.monitoringLastUpdate || null,
    macToIpEnabled: settings?.macToIpEnabled ?? true,
    statsReportInterval: settings?.statsReportInterval || null
  });
});

// API: Обновить настройки (autolock, telegram, macToIpEnabled)
app.post('/api/settings', express.json(), async (req, res) => {
  let settings = await SettingsModel.findOne();
  if (!settings) settings = new SettingsModel();
  if (req.body.autolockMinutes) settings.autolockMinutes = req.body.autolockMinutes;
  if (req.body.telegramToken !== undefined) settings.telegramToken = req.body.telegramToken;
  if (req.body.telegramChatId !== undefined) settings.telegramChatId = req.body.telegramChatId;
  if (req.body.telegramEnabled !== undefined) settings.telegramEnabled = req.body.telegramEnabled;
  if (req.body.telegramInitialized !== undefined) settings.telegramInitialized = req.body.telegramInitialized;
  if (req.body.theme !== undefined) settings.theme = req.body.theme;
  if (req.body.serverAddress !== undefined) settings.serverAddress = req.body.serverAddress;
  if (req.body.macToIpEnabled !== undefined) settings.macToIpEnabled = req.body.macToIpEnabled;
  if (req.body.statsReportInterval !== undefined) settings.statsReportInterval = req.body.statsReportInterval;
  await settings.save();
  // Обновляем настройки в модуле telegram
  updateTelegramSettings({
    telegramToken: settings.telegramToken,
    telegramChatId: settings.telegramChatId,
    telegramEnabled: settings.telegramEnabled
  });
  res.json({ success: true });
});

// API: Получить лицензию и поддержку
app.get('/api/license', (req, res) => {
  res.json({
    expire: process.env.LICENSE_EXPIRE,
    support: process.env.TELEGRAM_SUPPORT_ID
  });
});

// API: Получить только telegram-настройки (для telegram.js)
app.get('/api/settings/telegram', async (req, res) => {
  const settings = await SettingsModel.findOne();
  res.json({
    telegramToken: settings?.telegramToken || '',
    telegramChatId: settings?.telegramChatId || '',
    telegramEnabled: settings?.telegramEnabled || false
  });
});

// Получить monitoringEnabled и monitoringLastUpdate
app.get('/api/settings/monitoring', async (req, res) => {
  const settings = await SettingsModel.findOne();
  res.json({
    monitoringEnabled: settings?.monitoringEnabled ?? true,
    monitoringLastUpdate: settings?.monitoringLastUpdate || null
  });
});

// Изменить monitoringEnabled
app.post('/api/settings/monitoring', express.json(), async (req, res) => {
  let settings = await SettingsModel.findOne();
  if (!settings) settings = new SettingsModel();
  if (typeof req.body.monitoringEnabled === 'boolean') {
    settings.monitoringEnabled = req.body.monitoringEnabled;
    await settings.save();
  }
  res.json({ monitoringEnabled: settings.monitoringEnabled });
});

// Обновить monitoringLastUpdate (для скрипта)
app.post('/api/settings/monitoring-update', express.json(), async (req, res) => {  
  let settings = await SettingsModel.findOne();
  if (!settings) settings = new SettingsModel();
  settings.monitoringLastUpdate = new Date();
  await settings.save();
  res.json({ monitoringLastUpdate: settings.monitoringLastUpdate });
});

// Новые API эндпоинты для управления устройствами

// Получить полный список устройств со всеми данными
app.get('/api/devices/full', async (req, res) => {
  try {
    const devices = await DeviceModel.find();
    // Для каждого устройства добавляем время простоя
    const result = devices.map(dev => {
      let downtime = 0;
      if (dev.events && dev.events.length > 0) {
        for (let i = dev.events.length - 1; i >= 0; i--) {
          if (dev.events[i].status === 1) downtime++;
          else break;
        }
      }
      const deviceObj = dev.toObject();
      deviceObj.currentDowntimeMinutes = downtime;
      return deviceObj;
    });
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result));
  } catch (error) {
    logger.error('Ошибка получения списка устройств:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении списка устройств' });
  }
});

// Добавить новое устройство
app.post('/api/devices', express.json(), async (req, res) => {
  try {
    logger.info('Добавление нового устройства');
    // Проверка на уникальность MAC, serialNumber, worker
    const exists = await DeviceModel.findOne({
      $or: [
        { mac: req.body.mac },
        { serialNumber: req.body.serialNumber },
        { worker: req.body.worker }
      ]
    });
    if (exists) {
      return res.status(400).json({ error: 'Устройство с таким MAC, серийным номером или воркером уже существует' });
    }
    // Сохраняем все поля, которые пришли в req.body
    const device = new DeviceModel({
      ip: req.body.ip,
      name: req.body.name,
      model: req.body.model,
      mac: req.body.mac,
      serialNumber: req.body.serialNumber,
      worker: req.body.worker,
      consumption: req.body.consumption,
      cards: req.body.cards,
      comment: req.body.comment,
      enablePolling: req.body.enablePolling,
      inRepair: req.body.inRepair
    });
    await device.save();
    res.status(201).json(device);
  } catch (error) {
    logger.error('Ошибка добавления устройства:', error);
    res.status(500).json({ error: 'Ошибка сервера при добавлении устройства' });
  }
});

// Получить данные одного устройства
app.get('/api/devices/:id', async (req, res) => {
  try {
    const device = await DeviceModel.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Устройство не найдено' });
    }
    res.json(device);
  } catch (error) {
    logger.error('Ошибка получения устройства:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении устройства' });
  }
});

// Обновить устройство
app.put('/api/devices/:id', express.json(), async (req, res) => {
  try {
    // Если IP изменился, проверяем, не занят ли он
    if (req.body.ip) {
      const existingDevice = await DeviceModel.findOne({ 
        ip: req.body.ip, 
        _id: { $ne: req.params.id } 
      });
      
      if (existingDevice) {
        return res.status(400).json({ error: 'Устройство с таким IP уже существует' });
      }
    }
    
    const device = await DeviceModel.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    );
    
    if (!device) {
      return res.status(404).json({ error: 'Устройство не найдено' });
    }
    
    res.json(device);
  } catch (error) {
    logger.error('Ошибка обновления устройства:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении устройства' });
  }
});

// Удалить устройство
app.delete('/api/devices/:id', async (req, res) => {
  try {
    const device = await DeviceModel.findByIdAndDelete(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Устройство не найдено' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Ошибка удаления устройства:', error);
    res.status(500).json({ error: 'Ошибка сервера при удалении устройства' });
  }
});

// Обновить отдельные настройки устройства
app.patch('/api/devices/:id/settings', express.json(), async (req, res) => {
  try {
    const allowedSettings = ['inRepair', 'enablePolling'];
    const updateData = {};
    
    // Фильтруем только разрешенные параметры
    Object.keys(req.body).forEach(key => {
      if (allowedSettings.includes(key)) {
        updateData[key] = req.body[key];
      }
    });
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Нет допустимых параметров для обновления' });
    }
    
    const device = await DeviceModel.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );
    
    if (!device) {
      return res.status(404).json({ error: 'Устройство не найдено' });
    }
    
    res.json(device);
  } catch (error) {
    logger.error('Ошибка обновления настроек устройства:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении настроек устройства' });
  }
});

// Массовое обновление настроек для всех устройств
app.patch('/api/devices/settings/bulk', express.json(), async (req, res) => {
  try {
    const allowedSettings = ['inRepair', 'enablePolling'];
    const updateData = {};
    
    // Фильтруем только разрешенные параметры
    Object.keys(req.body).forEach(key => {
      if (allowedSettings.includes(key)) {
        updateData[key] = req.body[key];
      }
    });
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Нет допустимых параметров для обновления' });
    }
    
    const result = await DeviceModel.updateMany({}, updateData);
    
    res.json({ 
      success: true, 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    logger.error('Ошибка массового обновления настроек:', error);
    res.status(500).json({ error: 'Ошибка сервера при массовом обновлении настроек' });
  }
});

// API: Получить курс BTC к RUB (прокси для обхода CORS)
app.get('/api/btc-rate', async (req, res) => {
  try {
    const apiUrl = 'https://api.coinbase.com/v2/prices/BTC-RUB/spot';
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data && data.data && data.data.amount) {
      res.json({ rate: parseFloat(data.data.amount) });
    } else {
      res.json({ rate: 0 });
    }
  } catch (e) {
    res.json({ rate: 0 });
  }
});

// Диагностический API: Получить устройство по IP адресу
app.get('/api/devices/diagnostic/ip/:ip', async (req, res) => {
  try {
    const ip = req.params.ip;
    logger.info(`Диагностический поиск устройства с IP: ${ip}`);
    
    const device = await DeviceModel.findOne({ ip: ip });
    
    if (!device) {
      return res.json({ 
        exists: false, 
        message: `Устройство с IP ${ip} не найдено в базе данных`
      });
    }
    
    return res.json({
      exists: true,
      device: device.toObject(),
      message: `Устройство с IP ${ip} найдено в базе данных`
    });
  } catch (error) {
    logger.error(`Ошибка поиска устройства по IP ${req.params.ip}:`, error);
    res.status(500).json({ error: `Ошибка поиска устройства: ${error.message}` });
  }
});

// Пинг устройства
app.post('/api/devices/:id/ping', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const device = await DeviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: 'Устройство не найдено' });
    }
    
    // Пингуем устройство
    const result = await ping.promise.probe(device.ip, { timeout: 2 });
    
    // Обновляем статус устройства в БД
    const online = result.alive;
    const now = new Date();
    
    // Добавляем событие в историю
    device.events.push({ 
      timestamp: now, 
      status: online ? 0 : 1,
      type: 'status'
    });
    
    // Обрезаем историю до последних 1440 событий (сутки, если минута интервал)
    if (device.events.length > 1440) {
      device.events = device.events.slice(device.events.length - 1440);
    }
    
    if (online) {
      device.status = 'online';
      if (device.status === 'offline') {
        device.lastOnline = now;
      }
    } else {
      device.status = 'offline';
    }
    
    device.lastChecked = now;
    await device.save();
    
    // Возвращаем результат
    res.json({
      status: online ? 'online' : 'offline',
      pingTime: result.time,
      ip: device.ip
    });
  } catch (error) {
    logger.error(`Ошибка пинга устройства ${req.params.id}:`, error);
    res.status(500).json({ error: `Ошибка пинга устройства: ${error.message}` });
  }
});

// Получить историю устройства по ID
app.get('/api/devices/:id/history', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const device = await DeviceModel.findById(deviceId);
    
    if (!device) {
      return res.status(404).json({ error: 'Устройство не найдено' });
    }
    
    // Возвращаем все события устройства
    res.json(device.events || []);
  } catch (error) {
    logger.error(`Ошибка получения истории устройства ${req.params.id}:`, error);
    res.status(500).json({ error: `Ошибка получения истории: ${error.message}` });
  }
});

// Сканирование сети
app.get('/api/devices/scan', (req, res) => {
  const startIp = req.query.startIp;
  const endIp = req.query.endIp;
  
  if (!startIp || !endIp) {
    return res.status(400).json({ error: 'Необходимо указать начальный и конечный IP адрес' });
  }
  
  // Устанавливаем заголовки для SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Функция для разбора IP и преобразования в число
  const ipToLong = ip => {
    const parts = ip.split('.');
    return ((parts[0] & 0xff) << 24) | 
           ((parts[1] & 0xff) << 16) | 
           ((parts[2] & 0xff) << 8) | 
           (parts[3] & 0xff);
  };
  
  // Функция для преобразования числа обратно в IP
  const longToIp = long => {
    return [
      (long >>> 24) & 0xff,
      (long >>> 16) & 0xff,
      (long >>> 8) & 0xff,
      long & 0xff
    ].join('.');
  };
  
  // Получаем числовые представления IP-адресов
  const startLong = ipToLong(startIp);
  const endLong = ipToLong(endIp);
  
  if (startLong > endLong) {
    res.write(`data: ${JSON.stringify({ error: 'Начальный IP должен быть меньше конечного' })}\n\n`);
    res.end();
    return;
  }
  
  // Создаем массив из всех IP в указанном диапазоне
  const allIps = [];
  for (let i = startLong; i <= endLong; i++) {
    allIps.push(longToIp(i));
  }
  
  let newDevicesCount = 0;
  let processedCount = 0;
  
  // Функция для отправки обновления состояния клиенту
  const sendUpdate = () => {
    const progress = Math.round((processedCount / allIps.length) * 100);
    res.write(`data: ${JSON.stringify({ progress, newDevices: newDevicesCount })}\n\n`);
  };
  
  // Обрабатываем пинг каждого IP адреса
  const limit = pLimit(10); // Ограничиваем количество параллельных запросов
  
  Promise.all(
    allIps.map(ip => limit(async () => {
      try {
        // Проверяем, существует ли уже такое устройство в БД
        const existingDevice = await DeviceModel.findOne({ ip });
        
        if (existingDevice) {
          processedCount++;
          if (processedCount % 5 === 0) sendUpdate();
          return; // Пропускаем существующие устройства
        }
        
        // Пингуем новый IP
        const pingResult = await ping.promise.probe(ip, { timeout: 2 });
        
        // Добавляем только устройства, отвечающие на пинг
        if (pingResult.alive) {
          const now = new Date();
          const device = new DeviceModel({
            ip: ip,
            status: 'online',
            lastChecked: now,
            lastOnline: now,
            events: [{ timestamp: now, status: 0, type: 'status' }]
          });
          
          await device.save();
          newDevicesCount++;
          logger.info(`Найдено новое устройство: ${ip}`);
        }
        
        processedCount++;
        if (processedCount % 5 === 0) sendUpdate();
      } catch (error) {
        logger.error(`Ошибка при сканировании IP ${ip}:`, error);
        processedCount++;
        if (processedCount % 5 === 0) sendUpdate();
      }
    }))
  ).then(() => {
    // Сканирование завершено
    res.write(`data: ${JSON.stringify({ progress: 100, newDevices: newDevicesCount, complete: true })}\n\n`);
    res.end();
  }).catch(error => {
    logger.error('Ошибка при сканировании сети:', error);
    res.write(`data: ${JSON.stringify({ error: 'Ошибка при сканировании сети' })}\n\n`);
    res.end();
  });
});

// Отладочный API для получения устройств в текстовом формате
app.get('/api/devices/debug/text', async (req, res) => {
  try {
    logger.info('Запрос отладочного API: /api/devices/debug/text');
    const devices = await DeviceModel.find();
    
    // Устанавливаем текстовый формат ответа
    res.setHeader('Content-Type', 'text/plain');
    
    let result = `Всего устройств: ${devices.length}\n\n`;
    
    devices.forEach((device, index) => {
      result += `[${index + 1}] Устройство ${device._id}\n`;
      result += `  IP: ${device.ip}\n`;
      result += `  Статус: ${device.status}\n`;
      result += `  Опрос включен: ${device.enablePolling ? 'Да' : 'Нет'}\n`;
      result += `  В ремонте: ${device.inRepair ? 'Да' : 'Нет'}\n`;
      result += `  Последняя проверка: ${device.lastChecked ? device.lastChecked.toLocaleString() : 'Никогда'}\n`;
      result += `  Событий: ${device.events ? device.events.length : 0}\n\n`;
    });
    
    res.send(result);
    logger.info('Отладочные данные отправлены в текстовом формате');
  } catch (error) {
    logger.error('Ошибка при получении отладочных данных:', error);
    res.status(500).send(`Ошибка: ${error.message}`);
  }
});

// Отладочный API для прямого доступа к базе данных в формате JSON (теперь основной метод)
app.get('/api/devices/debug/json', async (req, res) => {
  try {
    logger.info('Запрос основного API для устройств: /api/devices/debug/json');
    
    // Проверяем параметр includeEvents
    const includeEvents = req.query.includeEvents === 'true';
    
    // Выбираем проекцию полей в зависимости от параметра
    let projection = {};
    if (!includeEvents) {
      projection = { events: 0 }; // Исключаем события, если не запрошены
    }
    
    const devices = await DeviceModel.find({}, projection);
    
    logger.info(`Найдено ${devices.length} устройств в базе данных`);
    logger.info(`Включение событий в ответ: ${includeEvents ? 'Да' : 'Нет'}`);
    
    // Преобразуем в простой JSON (массив объектов)
    const simpleJson = devices.map(device => {
      // Преобразуем Mongoose объект в обычный JS объект
      const deviceObj = device.toObject();
      return deviceObj;
    });
    
    // Настраиваем кэширование на 5 секунд
    res.setHeader('Cache-Control', 'public, max-age=5');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(simpleJson));
    
    logger.info(`Отправлено ${simpleJson.length} устройств клиенту`);
  } catch (error) {
    logger.error('Ошибка при получении данных:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Список воркеров с их IP и количеством простоев
app.get('/api/workers', async (req, res) => {
  // Группируем по воркеру, берём последний IP и считаем количество простоев (status: 1)
  const agg = await DowntimeModel.aggregate([
    { $sort: { timestamp: -1 } },
    { $group: {
      _id: '$worker',
      ip: { $first: '$ip' },
      downtimeCount: { $sum: { $cond: [ { $eq: ['$status', 1] }, 1, 0 ] } }
    } },
    { $project: { _id: 0, worker: '$_id', ip: 1, downtimeCount: 1 } },
    { $sort: { worker: 1 } }
  ]);
  // Собираем воркеры из устройств
  const devices = await DeviceModel.find({ worker: { $exists: true, $ne: null, $ne: '' } });
  const unique = {};
  agg.forEach(w => { unique[w.worker] = { ...w }; });
  devices.forEach(d => {
    if (d.worker && !unique[d.worker]) {
      unique[d.worker] = { worker: d.worker, ip: d.ip, downtimeCount: 0 };
    }
  });
  res.json(Object.values(unique));
});

// API: График онлайна/простоев по воркеру
app.get('/api/workers/:worker/downtime', async (req, res) => {
  const worker = req.params.worker;
  // Получаем все события по воркеру, сортируем по времени
  const events = await DowntimeModel.find({ worker }).sort({ timestamp: 1 });
  const labels = events.map(e => e.timestamp.toLocaleString('ru-RU'));
  const values = events.map(e => e.status); // 0 — online, 1 — offline
  res.json({ labels, values });
});

// === API для моделей устройств ===
// Получить список моделей
app.get('/api/device-models', async (req, res) => {
  try {
    const models = await DeviceModelModel.find();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера при получении моделей устройств' });
  }
});

// Добавить новую модель
app.post('/api/device-models', express.json(), async (req, res) => {
  try {    
    const { name, consumption, ths } = req.body;
    if (!name || !consumption) return res.status(400).json({ error: 'Заполните все поля' });
    const exists = await DeviceModelModel.findOne({ name });
    if (exists) return res.status(400).json({ error: 'Такая модель уже есть' });
    const model = await DeviceModelModel.create({ name, consumption, ths });
    res.status(201).json(model);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера при добавлении модели' });
  }
});

// Обновить модель устройства
app.put('/api/device-models/:id', express.json(), async (req, res) => {
  try {
    const { name, consumption, ths } = req.body;
    if (!name || !consumption) return res.status(400).json({ error: 'Заполните все поля' });
    const exists = await DeviceModelModel.findOne({ name, _id: { $ne: req.params.id } });
    if (exists) return res.status(400).json({ error: 'Такая модель уже есть' });
    const updated = await DeviceModelModel.findByIdAndUpdate(
      req.params.id,
      { name, consumption, ths },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Модель не найдена' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера при обновлении модели' });
  }
});

// Удалить модель устройства
app.delete('/api/device-models/:id', async (req, res) => {
  try {
    const result = await DeviceModelModel.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Модель не найдена' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера при удалении модели' });
  }
});

// === API для пользователей ===
// Получить список пользователей
app.get('/api/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});
// Добавить пользователя
app.post('/api/users', express.json(), async (req, res) => {
  try {
    const { fio, phone, telegramId, tariff, email, password, role, workers, contractFile } = req.body;
    const user = await User.create({ fio, phone, telegramId, tariff, email, password, role, workers, contractFile });
    res.status(201).json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// Редактировать пользователя
app.put('/api/users/:id', express.json(), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// Удалить пользователя
app.delete('/api/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});
// Архивировать пользователя
app.patch('/api/users/:id/archive', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { archived: true }, { new: true });
  res.json(user);
});
// Разархивировать пользователя
app.patch('/api/users/:id/unarchive', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { archived: false }, { new: true });
  res.json(user);
});
// Отправить сообщение в Telegram (заглушка)
app.post('/api/users/:id/telegram', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.telegramId) return res.status(400).json({ error: 'У пользователя не указан Telegram ID' });
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Нет текста сообщения' });
    const ok = await sendTelegramToUser(user.telegramId, message);
    if (!ok) return res.status(500).json({ error: 'Ошибка отправки сообщения' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// Генерация счёта (заглушка)
app.post('/api/users/:id/invoice', async (req, res) => {
  // Здесь будет логика генерации счёта
  res.json({ success: true });
});

// Создать счет
app.post('/api/invoices', express.json(), async (req, res) => {
  try {
    const invoice = await Invoice.create(req.body);
    res.status(201).json(invoice);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Получить список счетов
app.get('/api/invoices', async (req, res) => {
  const { status, client, from, to, search } = req.query;
  let filter = {};
  if (status && status !== 'all') filter.status = status;
  if (client) filter.clientFio = { $regex: client, $options: 'i' };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (search) filter.$or = [
    { clientFio: { $regex: search, $options: 'i' } },
    { _id: search }
  ];
  const invoices = await Invoice.find(filter).sort({ createdAt: -1 });
  res.json(invoices);
});

// Получить счет по id
app.get('/api/invoices/:id', async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Счет не найден' });
  res.json(invoice);
});

// Удалить счет
app.delete('/api/invoices/:id', async (req, res) => {
  await Invoice.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Получить/изменить macToIpEnabled отдельно
app.get('/api/settings/mac-to-ip', async (req, res) => {
  const settings = await SettingsModel.findOne();
  res.json({ macToIpEnabled: settings?.macToIpEnabled ?? true });
});
app.post('/api/settings/mac-to-ip', express.json(), async (req, res) => {
  const updated = await SettingsModel.findOneAndUpdate(
    {},
    { macToIpEnabled: !!req.body.macToIpEnabled },
    { new: true, upsert: true }
  );
  res.json({ macToIpEnabled: updated.macToIpEnabled });
});

// Удалить воркера из всех устройств и простоев
app.delete('/api/workers/:worker', async (req, res) => {
  const worker = req.params.worker;
  try {
    // Удалить воркера из всех устройств
    await DeviceModel.updateMany({ worker }, { $set: { worker: '' } });
    // Удалить все события простоев с этим воркером
    await DowntimeModel.deleteMany({ worker });
    // (опционально) удалить воркера из всех пользователей
    await User.updateMany(
      { workers: worker },
      { $pull: { workers: worker } }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка при удалении воркера' });
  }
});

// Запуск сервера
// Проверка лицензии при запуске
function isLicenseExpired() {
  if (!process.env.LICENSE_EXPIRE) return false;
  const now = new Date();
  const expire = new Date(process.env.LICENSE_EXPIRE);
  return now > expire;
}

if (isLicenseExpired()) {
  logger.error(`Лицензия истекла (${process.env.LICENSE_EXPIRE}). Поддержка: ${process.env.TELEGRAM_SUPPORT_ID}`);
  process.exit(1);
}

mongoose.connect(MONGO_URI).then(async () => {
  await ensureSettingsAndAdmin();
  
  // Запускаем сервер
  app.listen(PORT, () => {
    logger.info(`API server running on http://localhost:${PORT}`);
    
    // После запуска сервера инициализируем модуль telegram
    // настройками из базы данных
    initializeTelegramModule();
  });
});

// Инициализация модуля telegram настройками из базы данных
async function initializeTelegramModule() {
  try {
    const settings = await SettingsModel.findOne();
    if (settings) {
      initTelegram({
        telegramToken: settings.telegramToken,
        telegramChatId: settings.telegramChatId,
        telegramEnabled: settings.telegramEnabled
      });
    } else {
      logger.warn('Не удалось инициализировать Telegram: настройки не найдены в базе данных');
    }
  } catch (error) {
    logger.error('Ошибка при инициализации Telegram:', error);
  }
}

app.get('/api/users/:id/invoice', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.workers || !user.workers.length) return res.status(400).json({ error: 'У пользователя нет воркеров' });
    const { from, to, coef } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'Не указан период' });
    const coefNum = parseFloat(coef) || 1.02;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const workerBases = user.workers.map(w => w.split('.')[0]);
    const allDevices = await DeviceModel.find({ worker: { $exists: true, $ne: null, $ne: '' } });
    const clientDevices = allDevices.filter(d =>
      d.worker && workerBases.some(base => d.worker.startsWith(base + '.'))
    );
    const tariff = Number(user.tariff) || 0;
    let totalAmount = 0;
    let totalDowntime = 0;
    let totalConsumption = 0;
    const details = [];
    for (const device of clientDevices) {
      // Получаем метки простоев из DowntimeModel
      const downtimes = await DowntimeModel.find({
        worker: device.worker,
        timestamp: { $gte: fromDate, $lte: toDate }
      });
      const minutesWorked = downtimes.filter(d => d.status === 0).length;
      const minutesDowntime = downtimes.filter(d => d.status === 1).length;
      const consumption = device.consumption || 0;
      const hoursWorked = minutesWorked / 60;
      const amount = (consumption * hoursWorked * coefNum) * tariff;
      details.push({
        worker: device.worker,
        serialNumber: device.serialNumber || '',
        consumption,
        minutesWorked,
        minutesDowntime,
        amount: Number(amount.toFixed(2))
      });
      totalDowntime += minutesDowntime;
      totalAmount += amount;
      totalConsumption += consumption;
    }
    res.json({ totalDowntime, totalAmount: Number(totalAmount.toFixed(2)), totalConsumption, tariff, details });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


