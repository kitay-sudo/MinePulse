import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

// Вместо глобальных переменных будем получать настройки из аргументов функций
// или из вызовов через init()

let settings = {
  telegramToken: '',
  telegramChatId: '',
  telegramEnabled: false
};

// Инициализация модуля (будет вызываться из server.js после старта сервера)
export function init(newSettings) {
  settings = { ...newSettings };
  logger.info(`Telegram модуль инициализирован. Уведомления ${settings.telegramEnabled ? 'включены' : 'выключены'}`);
}

// Обновление настроек (вызывается при изменении настроек)
export function updateSettings(newSettings) {
  const oldSettings = { ...settings };
  settings = { ...newSettings };
  
  const changed = (
    oldSettings.telegramToken !== settings.telegramToken || 
    oldSettings.telegramChatId !== settings.telegramChatId || 
    oldSettings.telegramEnabled !== settings.telegramEnabled
  );
  
  if (changed) {
    logger.info(`Telegram настройки обновлены. Уведомления ${settings.telegramEnabled ? 'включены' : 'выключены'}`);
  }
}

// Проверка соединения с Telegram
export async function testTelegramConnection(token, chatId) {
  if (!token || !chatId) {
    return { success: false, error: 'Не указаны токен или chat_id' };
  }
  
  try {
    // Проверка токена
    const botRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    if (!botRes.ok) {
      return { success: false, error: 'Неверный токен бота' };
    }
    
    const botData = await botRes.json();
    if (!botData.ok) {
      return { success: false, error: 'API вернул ошибку: ' + botData.description };
    }
    
    // Проверка chat_id отправкой тестового сообщения
    const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: '✅ Тестовое соединение установлено'
      })
    });
    
    if (!msgRes.ok) {
      const msgData = await msgRes.json();
      return { success: false, error: 'Ошибка отправки сообщения: ' + (msgData.description || 'неизвестная ошибка') };
    }
    
    return { 
      success: true, 
      botName: botData.result.username 
    };
  } catch (e) {
    logger.error('Ошибка проверки Telegram соединения:', e);
    return { success: false, error: e.message || 'Сетевая ошибка' };
  }
}

export async function sendTelegramAlert(message) {
  if (!settings.telegramEnabled) {
    logger.info('Telegram уведомления отключены, сообщение не отправлено');
    return false;
  }
  
  if (!settings.telegramToken || !settings.telegramChatId) {
    logger.warn('Не удалось отправить Telegram-уведомление: не указаны токен или chat_id');
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${settings.telegramToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: settings.telegramChatId, 
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    if (!res.ok) {
      const error = await res.text();
      logger.error(`Telegram error: ${error}`);
      return false;
    }
    
    return true;
  } catch (e) {
    logger.error('Ошибка отправки Telegram-уведомления:', e);
    return false;
  }
}

export async function sendTelegramToUser(chatId, message) {
  if (!settings.telegramEnabled) {
    logger.info('Telegram уведомления отключены, сообщение не отправлено');
    return false;
  }
  if (!settings.telegramToken || !chatId) {
    logger.warn('Не удалось отправить Telegram-сообщение: не указан токен или chat_id');
    return false;
  }
  try {
    const url = `https://api.telegram.org/bot${settings.telegramToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: message,
        parse_mode: 'HTML'
      })
    });
    if (!res.ok) {
      const error = await res.text();
      logger.error(`Telegram error: ${error}`);
      return false;
    }
    return true;
  } catch (e) {
    logger.error('Ошибка отправки Telegram-сообщения:', e);
    return false;
  }
}

// Отправка фото с подписью в Telegram
export async function sendTelegramPhoto(caption) {
  if (!settings.telegramEnabled) {
    logger.info('Telegram уведомления отключены, фото не отправлено');
    return false;
  }
  if (!settings.telegramToken || !settings.telegramChatId) {
    logger.warn('Не удалось отправить Telegram-фото: не указаны токен или chat_id');
    return false;
  }
  const publicUrl = process.env.SERVER_PUBLIC_URL;
  if (!publicUrl) {
    // Если нет SERVER_PUBLIC_URL — отправляем просто текст
    logger.info('SERVER_PUBLIC_URL не задан — отправляю только текстовое сообщение');
    return await sendTelegramAlert(caption);
  }
  try {
    const url = `https://api.telegram.org/bot${settings.telegramToken}/sendPhoto`;
    const photoUrl = `${publicUrl}/img/logo-telegram.png`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.telegramChatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'HTML'
      })
    });
    if (!res.ok) {
      const error = await res.text();
      logger.error(`Telegram sendPhoto error: ${error}`);
      return false;
    }
    return true;
  } catch (e) {
    logger.error('Ошибка отправки Telegram-фото:', e);
    return false;
  }
} 