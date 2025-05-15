import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ErrorLog from '../models/errorLog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем папку для логов если её нет
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logFile = path.join(logsDir, 'app.log');

// Русские уровни логирования
const LOG_LEVELS = {
  INFO: 'ИНФО',
  WARN: 'ВНИМАНИЕ',
  ERROR: 'ОШИБКА',
  DEBUG: 'ОТЛАДКА'
};

// Форматирование сообщения по-русски, без скобок, с МСК временем
function formatMessage(level, message, meta = {}) {
  // Переводим UTC в МСК (+3 часа)
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const dateStr = msk.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\./g, '-');
  let metaStr = '';
  if (meta && Object.keys(meta).length) {
    // Переводим ключи на русский и делаем строку
    metaStr = Object.entries(meta)
      .map(([k, v]) => {
        const rusKey = {
          totalDevices: 'всего',
          pollingDevices: 'для опроса',
          worker: 'воркер',
          online: 'онлайн',
          offline: 'оффлайн',
          inRepair: 'в ремонте',
          interval: 'интервал',
          device: 'устройство',
          status: 'статус',
          count: 'кол-во',
        }[k] || k;
        return `${rusKey}: ${v}`;
      })
      .join(', ');
    if (metaStr) metaStr = ': ' + metaStr;
  }
  return `${dateStr} [${level}] ${message}${metaStr}`;
}

// Запись в файл
function writeToFile(message) {
  fs.appendFileSync(logFile, message + '\n');
}

// Запись в консоль
function writeToConsole(message) {
  console.log(message);
}

// Запись в базу данных
async function writeToDB(level, message, meta = {}) {
  try {
    await ErrorLog.create({
      type: level.toLowerCase(),
      message,
      stack: meta.stack || '',
      route: meta.route || '',
      meta: {
        ...meta,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Ошибка записи лога в базу данных:', error);
  }
}

// Основные функции логирования
export const logger = {
  info: async (message, meta = {}) => {
    const formattedMessage = formatMessage(LOG_LEVELS.INFO, message, meta);
    writeToFile(formattedMessage);
    writeToConsole(formattedMessage);
    await writeToDB(LOG_LEVELS.INFO, message, meta);
  },

  warn: async (message, meta = {}) => {
    const formattedMessage = formatMessage(LOG_LEVELS.WARN, message, meta);
    writeToFile(formattedMessage);
    writeToConsole(formattedMessage);
    await writeToDB(LOG_LEVELS.WARN, message, meta);
  },

  error: async (message, error = null, meta = {}) => {
    const errorMeta = {
      ...meta,
      stack: error?.stack,
      error: error?.message
    };
    const formattedMessage = formatMessage(LOG_LEVELS.ERROR, message, errorMeta);
    writeToFile(formattedMessage);
    writeToConsole(formattedMessage);
    await writeToDB(LOG_LEVELS.ERROR, message, errorMeta);
  },

  debug: async (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = formatMessage(LOG_LEVELS.DEBUG, message, meta);
      writeToFile(formattedMessage);
      writeToConsole(formattedMessage);
      await writeToDB(LOG_LEVELS.DEBUG, message, meta);
    }
  }
};

// Класс для пользовательских ошибок
export class AppError extends Error {
  constructor(message, statusCode = 500, meta = {}) {
    super(message);
    this.statusCode = statusCode;
    this.meta = meta;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Обработчик ошибок
export async function errorHandler(error, req = null) {
  const meta = {
    ...(req && {
      route: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?._id
    }),
    ...error.meta
  };

  if (error instanceof AppError) {
    await logger.error(error.message, error, meta);
  } else {
    await logger.error('Неожиданная ошибка', error, meta);
  }

  return {
    success: false,
    error: error.message,
    statusCode: error.statusCode || 500
  };
} 