// Общие функции для всех страниц

/**
 * Показывает сообщение об ошибке
 * @param {string} message - текст сообщения
 * @param {number} duration - длительность показа в миллисекундах
 */
function showError(message, duration = 5000) {
  showNotification(message, 'danger', duration);
}

/**
 * Показывает информационное сообщение
 * @param {string} message - текст сообщения
 * @param {number} duration - длительность показа в миллисекундах
 */
function showInfo(message, duration = 3000) {
  showNotification(message, 'info', duration);
}

/**
 * Показывает сообщение об успешном действии
 * @param {string} message - текст сообщения
 * @param {number} duration - длительность показа в миллисекундах
 */
function showSuccess(message, duration = 3000) {
  showNotification(message, 'success', duration);
}

/**
 * Показывает предупреждение
 * @param {string} message - текст сообщения
 * @param {number} duration - длительность показа в миллисекундах
 */
function showWarning(message, duration = 4000) {
  showNotification(message, 'warning', duration);
}

/**
 * Базовая функция показа уведомлений
 * @param {string} message - текст сообщения
 * @param {string} type - тип сообщения (success, danger, warning, info)
 * @param {number} duration - длительность показа в миллисекундах
 */
function showNotification(message, type = 'info', duration = 3000) {
  // Создаем контейнер для уведомлений, если его нет
  let notificationContainer = document.getElementById('notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.top = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.zIndex = '9999';
    document.body.appendChild(notificationContainer);
  }

  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.className = `alert alert-${type} alert-dismissible fade show`;
  notification.role = 'alert';
  notification.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  // Добавляем уведомление в контейнер
  notificationContainer.appendChild(notification);

  // Инициализируем Bootstrap alert
  const bsAlert = new bootstrap.Alert(notification);

  // Автоматически скрываем уведомление через указанное время
  if (duration > 0) {
    setTimeout(() => {
      bsAlert.close();
    }, duration);
  }

  // Удаляем элемент из DOM после скрытия
  notification.addEventListener('closed.bs.alert', () => {
    notification.remove();
  });
}

/**
 * Форматирует дату в локальный формат
 * @param {string|Date} dateStr - дата в формате строки ISO или объект Date
 * @param {boolean} includeTime - включать ли время в результат
 * @returns {string} - отформатированная дата
 */
function formatDate(dateStr, includeTime = true) {
  if (!dateStr) return 'Н/Д';
  
  const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
  
  if (isNaN(date.getTime())) return 'Недействительная дата';
  
  const options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
  }
  
  return date.toLocaleDateString('ru-RU', options);
}

/**
 * Проверяет ответ fetch на ошибки
 * @param {Response} response - ответ fetch
 * @returns {Promise} - промис с данными или ошибкой
 */
async function handleApiResponse(response) {
  if (!response.ok) {
    // Пытаемся получить информацию об ошибке из ответа
    const errorData = await response.json().catch(() => ({
      error: `Ошибка ${response.status}: ${response.statusText}`
    }));
    
    throw new Error(errorData.error || `Ошибка API: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Выполняет запрос к API с обработкой ошибок
 * @param {string} url - URL запроса
 * @param {Object} options - параметры запроса fetch
 * @returns {Promise} - промис с данными
 */
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    return await handleApiResponse(response);
  } catch (error) {
    console.error(`Ошибка запроса к ${url}:`, error);
    throw error;
  }
}

window.showLoading = function(containerId) {};
window.hideLoading = function(containerId) {}; 