import 'dotenv/config';
import mongoose from 'mongoose';
import ping from 'ping';
import pLimit from 'p-limit';
import { sendTelegramAlert, sendTelegramPhoto, updateSettings as updateTelegramSettings } from '../notifications/telegram.js';
import DeviceModel from '../models/device.js';
import ErrorLog from '../models/errorLog.js';
import { logger, AppError, errorHandler } from '../utils/logger.js';
import PingErrorModel from '../models/pingError.js';
import DowntimeModel from '../models/downtime.js';
import SettingsModel from '../models/settings.js';
import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import os from 'os';

const MONGO_URI = process.env.MONGO_URI;
const PING_INTERVAL = parseInt(process.env.PING_INTERVAL || '60', 10); // in seconds
const ALERT_OFFLINE_MINUTES = 5; // offline threshold for alert
const STATS_REPORT_INTERVAL_MINUTES = parseInt(process.env.STATS_REPORT_INTERVAL_MINUTES || '60', 10);
const NETWORK_BASES = process.env.NETWORK_BASES ? process.env.NETWORK_BASES.split(',').map(s => s.trim()) : null;

let firstPollDone = false;
let lastStatsSent = 0;

async function loadDevicesFromDB() {
  try {
    // Получаем только устройства, для которых включен опрос
    const allDevices = await DeviceModel.find();
    const devicesForPolling = await DeviceModel.find({ enablePolling: true });
    
    await logger.info('Загрузка устройств из базы данных', {
      totalDevices: allDevices.length,
      pollingDevices: devicesForPolling.length
    });
    
    if (allDevices.length > 0 && devicesForPolling.length === 0) {
      await logger.warn('У всех устройств отключен опрос', {
        totalDevices: allDevices.length,
        pollingDevices: devicesForPolling.length
      });
    }
    return devicesForPolling;
  } catch (error) {
    throw new AppError('Ошибка загрузки устройств из базы данных', 500, { error: error.message });
  }
}

async function updateDeviceStatus(device, online) {
  const now = new Date();
  
  try {
    // Определяем тип события
    const eventType = device.inRepair ? 'repair' : 'status';
    
    // Добавляем событие в историю
    device.events.push({ 
      timestamp: now, 
      status: online ? 0 : 1,
      type: eventType,
      worker: device.worker
    });
    
    // Обрезаем историю до последних 1440 событий (сутки, если минута интервал)
    if (device.events.length > 1440) {
      device.events = device.events.slice(device.events.length - 1440);
    }
    
    // Если устройство в ремонте, всегда устанавливаем статус offline
    if (device.inRepair) {
      device.status = 'offline';
    } else if (online) {
      if (device.status === 'offline') {
        device.lastOnline = now;
      }
      device.status = 'online';
      // Сбросить флаг алерта при возврате online
      if (device.lastAlertedOfflineAt) {
        device.lastAlertedOfflineAt = null;
      }
    } else {
      device.status = 'offline';
    }
  } catch (error) {
    throw new AppError('Ошибка обновления статуса устройства', 500, { error: error.message });
  }
}

// Получить IP по MAC через локальную ARP-таблицу
function getIpByMac(mac) {
  try {
    const arpOutput = execSync('arp -a').toString();
    const macNorm = mac.toLowerCase().replace(/-/g, ':');
    const regex = new RegExp(`([\d\.]+)\s+([\w-]+)\s+${macNorm.replace(/:/g, '[-:]?')}`, 'i');
    const lines = arpOutput.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes(macNorm)) {
        const match = line.match(/([\d\.]+)\s+([\w-]+)\s+([\da-f:-]{17})/i);
        if (match) {
          return match[1];
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function pingDevice(device, macToIpEnabled = false) {
  try {
    let ipToPing = device.ip;
    if (macToIpEnabled && device.mac) {
      const foundIp = getIpByMac(device.mac);
      if (foundIp) {
        if (device.ip !== foundIp) {
          device.ip = foundIp;
          await device.save();
        }
        ipToPing = foundIp;
        device.alert = '';
      } else {
        device.alert = `Не удалось получить IP по MAC-адресу: ${device.mac}`;
        await device.save();
        logger.error(`Не удалось получить IP по MAC: ${device.mac}, устройство: ${device._id}`);
        // Сохраняем ошибку в pingError
        await PingErrorModel.create({
          ip: device.ip,
          error: device.alert,
          worker: device.worker,
          timestamp: new Date()
        });
        return; // Пропускаем пинг
      }
    }
    const result = await ping.promise.probe(ipToPing);
    if (result.alive) {
      await updateDeviceStatus(device, true);
    } else {
      await updateDeviceStatus(device, false);
    }
  } catch (error) {
    // Сохраняем ошибку в pingError
    await PingErrorModel.create({
      ip: device.ip,
      error: error.message,
      worker: device.worker,
      timestamp: new Date()
    });
    throw new AppError('Ошибка пинга устройства', 500, { error: error.message });
  }
}

function formatStatsMessage(devices, isStart = false) {
  const total = devices.length;
  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline' && !d.inRepair).length;
  const repair = devices.filter(d => d.inRepair).length;
  const now = new Date();
  let msg = '';
  // if (isStart) {
  //   msg += 'Мониторинг устройств запущен <b>${now.toLocaleString('ru-RU')}</b>\n';
  // }
  msg += `Всего устройств: <b>${total}</b>\n`;
  msg += `Онлайн: <b>${online}</b>\n`;
  msg += `Оффлайн: <b>${offline}</b>\n`;
  msg += `В ремонте: <b>${repair}</b>\n`;
  return msg;
}

async function sendStatsToTelegram(devices, isStart = false) {
  const settings = await SettingsModel.findOne();
  updateTelegramSettings({
    telegramToken: settings.telegramToken,
    telegramChatId: settings.telegramChatId,
    telegramEnabled: settings.telegramEnabled
  });
  const msg = formatStatsMessage(devices, isStart);
  await sendTelegramPhoto(msg);
}

async function pollDevices() {
  try {
    const settings = await SettingsModel.findOne();
    if (!settings) return;
    if (typeof settings.telegramEnabled !== 'undefined') {
      logger.info(`Telegram уведомления: ${settings.telegramEnabled ? 'включены' : 'отключены'}`);
    }
    if (!settings.monitoringEnabled) {
      logger.info('Мониторинг отключён настройками. Опрос не выполняется.');
      return;
    }
    const macToIpEnabled = settings.macToIpEnabled ?? false;
    const devices = await loadDevicesFromDB();
    const total = devices.length;
    if (!firstPollDone) {
      logger.info(`Запуск мониторинга. Планируется опросить устройств: ${total}`);
    } else {
      logger.info(`Новый круг опроса. Устройств для опроса: ${total}`);
    }
    const t0 = performance.now();
    const limit = pLimit(450);
    await Promise.all(devices.map(async device => {
      try {
        await pingDevice(device, macToIpEnabled);
        device.lastChecked = new Date();
        await device.save();
      } catch (err) {
        const mac = device.mac || '-';
        const ip = device.ip || '-';
        const errText = err.meta?.error || err.message || 'Неизвестная ошибка';
        logger.error(`Ошибка опроса устройства: MAC=${mac}, IP=${ip}, error=${errText}`);
        // Можно также записывать в базу ошибок, если нужно
      }
    }));
    const t1 = performance.now();
    // Статистика
    const online = devices.filter(d => d.status === 'online').length;
    const offline = devices.filter(d => d.status === 'offline' && !d.inRepair).length;
    const repair = devices.filter(d => d.inRepair).length;
    logger.info(`Круг завершён: Всего: ${total}, Онлайн: ${online}, Оффлайн: ${offline}, В ремонте: ${repair}, Время: ${(t1-t0).toFixed(1)} мс`);
    // Обновляем monitoringLastUpdate в settings
    await SettingsModel.updateOne({}, { monitoringLastUpdate: new Date() });
    // Переношу отправку статистики в конец
    const now = Date.now();
    if (!lastStatsSent || now - lastStatsSent >= STATS_REPORT_INTERVAL_MINUTES * 60 * 1000) {
      await sendStatsToTelegram(devices, !firstPollDone);
      lastStatsSent = now;
    }
    if (!firstPollDone) {
      firstPollDone = true;
    }
  } catch (error) {
    throw new AppError('Ошибка опроса устройств', 500, { error: error.message });
  }
}

function getAllNetworkRanges() {
  if (NETWORK_BASES && NETWORK_BASES.length) {
    return NETWORK_BASES;
  }
  const interfaces = os.networkInterfaces();
  const bases = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        const ip = net.address.split('.');
        bases.push(`${ip[0]}.${ip[1]}.${ip[2]}`);
      }
    }
  }
  return [...new Set(bases)];
}

async function scanNetworkRange() {
  const bases = getAllNetworkRanges();
  if (!bases.length) {
    logger.warn('Не удалось определить диапазоны локальных сетей для сканирования');
    return;
  }
  for (const base of bases) {
    logger.info(`Сканирование подсети: ${base}.1-254`);
    const limit = pLimit(50);
    await Promise.all(
      Array.from({ length: 254 }, (_, i) => i + 1).map(i =>
        limit(async () => {
          const ip = `${base}.${i}`;
          try {
            await ping.promise.probe(ip, { timeout: 1 });
          } catch {}
        })
      )
    );
    logger.info(`Сканирование подсети ${base}.1-254 завершено`);
  }
}

// При запуске мониторинга — сначала сканируем диапазон
async function startPolling() {
  try {
    await scanNetworkRange();
    await pollDevices();
    setInterval(pollDevices, PING_INTERVAL * 1000);
  } catch (error) {
    throw new AppError('Ошибка запуска опроса устройств', 500, { error: error.message });
  }
}

async function stopPolling() {
  clearInterval(pollDevices);
}

async function main() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    await startPolling();
  } catch (error) {
    throw new AppError('Ошибка запуска приложения', 500, { error: error.message });
  }
}

// Экспортируем функцию для вызова при добавлении нового устройства (например, из API)
export async function scanNetworkOnNewDevice() {
  logger.info('Добавлено новое устройство — запускаю сканирование диапазона сети');
  await scanNetworkRange();
}

main();
