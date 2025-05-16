// Глобальные переменные
const apiUrl = '/api';
let refreshInterval;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  initNavigationHandlers();

  // Инициализируем обработчики глобальных событий
  initGlobalEventHandlers();

  // Активируем первый пункт меню по умолчанию (Устройства)
  const defaultSection = document.querySelector('.top-menu a[data-section="devices"]');
  if (defaultSection) {
    defaultSection.click();
  }

  // Автоматически запускаем показ устройств надежным методом после небольшой задержки
  setTimeout(() => {
    console.log('Автоматическая загрузка устройств...');
    
    // Используем альтернативный метод загрузки для надежности
    displayApiDataInTable().then(success => {
      console.log('Результат автоматической загрузки:', success ? 'успешно' : 'с ошибкой');
      
      // Если не получилось, пробуем обычную загрузку
      if (!success) {
        console.log('Пробуем обычную загрузку устройств...');
        loadDevices();
      }
    });
  }, 1000);

  // Запускаем обновление данных в фоне каждые 30 секунд
  refreshInterval = setInterval(loadDevices, 30000);

  // Удаляем все модальные оверлеи и сбрасываем блокировку скролла при загрузке страницы
  // Это предотвращает залипание overlay после закрытия модалок
  setTimeout(() => {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  }, 200);

  setTimeout(function() {
    document.body.classList.add('page-loaded');
  }, 50);
});

// Инициализация глобальных обработчиков событий
function initGlobalEventHandlers() {
  // Создаем контейнер для уведомлений, если его нет
  if (!document.getElementById('toastContainer')) {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '1100';
    document.body.appendChild(container);
  }

  // Инициализируем обработчики модальных окон
  document.querySelectorAll('[data-bs-toggle="modal"]').forEach(button => {
    button.addEventListener('click', function() {
      const target = document.getElementById(this.getAttribute('data-bs-target').substring(1));
      if (target) {
        const modal = new bootstrap.Modal(target);
        modal.show();
      }
    });
  });
}

// Инициализация навигации между разделами
function initNavigationHandlers() {
  document.querySelectorAll('.top-menu a').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const sectionId = this.getAttribute('data-section');
      
      // Скрыть все разделы
      document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
      });
      
      // Показать нужный раздел
      document.getElementById(sectionId + '-section').style.display = '';
      
      // Изменить активный пункт меню
      document.querySelectorAll('.top-menu a').forEach(l => l.classList.remove('active'));
      this.classList.add('active');
      
      // Загрузить данные для раздела при необходимости
      if(sectionId === 'devices') {
        loadDevices();
      } else if(sectionId === 'errors') {
        loadErrors();
      } else if(sectionId === 'settings') {
        loadSettings();
      } else if(sectionId === 'reports') {
        loadReports();
      }

      // Обновляем URL страницы для возможности закладок и обновления
      history.pushState({section: sectionId}, '', `/?section=${sectionId}`);
    });
  });

  // Восстановление состояния при навигации браузера назад/вперед
  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.section) {
      const sectionLink = document.querySelector(`.top-menu a[data-section="${e.state.section}"]`);
      if (sectionLink) {
        sectionLink.click();
      }
    }
  });

  // Проверяем URL при загрузке страницы
  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section');
  if (section) {
    const sectionLink = document.querySelector(`.top-menu a[data-section="${section}"]`);
    if (sectionLink) {
      setTimeout(() => sectionLink.click(), 0);
    }
  }
}

// Загрузка данных отчета
async function fetchReport(from, to) {
  const params = [];
  if (from) params.push(`from=${from}`);
  if (to) params.push(`to=${to}`);
  const res = await fetch(`${apiUrl}/report?${params.join('&')}`);
  return res.json();
}

// Тестирование доступности API. Вставьте в конец файла.
async function testApiEndpoint() {
  try {
    console.log('Тестирование API...');
    
    // Создаем уведомление о процессе
    const notification = document.createElement('div');
    notification.className = 'alert alert-info';
    notification.style.position = 'fixed';
    notification.style.top = '10px';
    notification.style.right = '10px';
    notification.style.zIndex = '9999';
    notification.innerHTML = 'Проверка API...';
    document.body.appendChild(notification);
    
    // Тестируем API устройств
    console.log('Тестирование эндпоинта /api/devices/full...');
    const resp = await fetch('/api/devices/full');
    console.log(`Статус ответа: ${resp.status} ${resp.statusText}`);
    
    if (resp.ok) {
      // Получаем тело ответа
      const text = await resp.text();
      console.log(`Получен ответ длиной ${text.length} символов`);
      notification.innerHTML = `Получен ответ от API (${text.length} символов)`;
      
      try {
        // Пробуем распарсить как JSON
        const json = JSON.parse(text);
        console.log('JSON корректен, распарсен успешно');
        console.log('Количество устройств в ответе:', Array.isArray(json) ? json.length : 'Данные не являются массивом');
        console.log('Тип данных:', Array.isArray(json) ? 'массив' : typeof json);
        
        // Если получен массив с устройствами, отображаем их в таблице
        if (Array.isArray(json) && json.length > 0) {
          notification.className = 'alert alert-success';
          notification.innerHTML = `Получено ${json.length} устройств. Размещение в таблице...`;
          
          // Размещаем данные в переменных для отображения
          window.devices = json;
          window.allDevices = [...json];
          
          // Обновляем интерфейс, обеспечивая доступность функций
          if (typeof updateDevicesStatistics === 'function') {
            updateDevicesStatistics();
          }
          if (typeof resetAllFilters === 'function') {
            resetAllFilters();
          } else {
            // Если функция недоступна, вызываем renderDevices напрямую если она существует
            if (typeof renderDevices === 'function') {
              renderDevices();
            }
          }
          
          setTimeout(() => {
            notification.innerHTML = `Данные успешно отображены в таблице (${json.length} устройств)`;
            setTimeout(() => notification.remove(), 3000);
          }, 500);
        } else {
          notification.className = 'alert alert-warning';
          notification.innerHTML = 'Получены данные, но они не содержат устройств';
          setTimeout(() => notification.remove(), 3000);
        }
        
        return true;
      } catch (e) {
        console.error('Ошибка парсинга JSON:', e);
        notification.className = 'alert alert-danger';
        notification.innerHTML = 'Ошибка при обработке данных: ' + e.message;
        setTimeout(() => notification.remove(), 3000);
        return false;
      }
    } else {
      console.error('Ошибка запроса:', resp.status, resp.statusText);
      notification.className = 'alert alert-danger';
      notification.innerHTML = `Ошибка API: ${resp.status} ${resp.statusText}`;
      setTimeout(() => notification.remove(), 3000);
      return false;
    }
  } catch (error) {
    console.error('Ошибка при тестировании API:', error);
    return false;
  }
}

// Отображение устройств из отладочного API в текстовом формате
async function showDebugText() {
  try {
    console.log('Получение отладочных данных в текстовом формате...');
    
    // Создаем всплывающее окно для отображения результата
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '10%';
    modal.style.left = '10%';
    modal.style.width = '80%';
    modal.style.height = '80%';
    modal.style.backgroundColor = 'var(--color-card)';
    modal.style.border = '1px solid var(--color-border)';
    modal.style.borderRadius = '5px';
    modal.style.padding = '20px';
    modal.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
    modal.style.zIndex = '9999';
    modal.style.overflow = 'auto';
    modal.style.color = 'var(--color-text)';
    
    // Добавляем заголовок
    const header = document.createElement('div');
    header.style.marginBottom = '10px';
    header.style.borderBottom = '1px solid var(--color-border)';
    header.style.paddingBottom = '10px';
    header.style.fontWeight = 'bold';
    header.textContent = 'Отладочная информация об устройствах';
    modal.appendChild(header);
    
    // Добавляем кнопку закрытия
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Закрыть';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.padding = '5px 10px';
    closeButton.onclick = () => modal.remove();
    modal.appendChild(closeButton);
    
    // Добавляем текстовое содержимое
    const content = document.createElement('pre');
    content.style.whiteSpace = 'pre-wrap';
    content.style.wordBreak = 'break-word';
    content.style.marginTop = '20px';
    content.textContent = 'Загрузка данных...';
    modal.appendChild(content);
    
    // Добавляем модальное окно в документ
    document.body.appendChild(modal);
    
    // Получаем данные
    const response = await fetch('/api/devices/debug/text');
    const text = await response.text();
    
    // Обновляем содержимое
    content.textContent = text;
    
    console.log('Отладочные данные в текстовом формате загружены');
  } catch (error) {
    console.error('Ошибка при получении отладочных данных:', error);
    showError(`Ошибка при получении отладочных данных: ${error.message}`);
  }
}

// Отображение устройств из отладочного API в формате JSON
async function showDebugJson() {
  try {
    console.log('Получение отладочных данных в формате JSON...');
    
    // Создаем всплывающее окно для отображения результата
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '10%';
    modal.style.left = '10%';
    modal.style.width = '80%';
    modal.style.height = '80%';
    modal.style.backgroundColor = 'var(--color-card)';
    modal.style.border = '1px solid var(--color-border)';
    modal.style.borderRadius = '5px';
    modal.style.padding = '20px';
    modal.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
    modal.style.zIndex = '9999';
    modal.style.overflow = 'auto';
    modal.style.color = 'var(--color-text)';
    
    // Добавляем заголовок
    const header = document.createElement('div');
    header.style.marginBottom = '10px';
    header.style.borderBottom = '1px solid var(--color-border)';
    header.style.paddingBottom = '10px';
    header.style.fontWeight = 'bold';
    header.textContent = 'Отладочная информация об устройствах в формате JSON';
    modal.appendChild(header);
    
    // Добавляем кнопку закрытия
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Закрыть';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.padding = '5px 10px';
    closeButton.onclick = () => modal.remove();
    modal.appendChild(closeButton);
    
    // Добавляем текстовое содержимое
    const content = document.createElement('pre');
    content.style.whiteSpace = 'pre-wrap';
    content.style.wordBreak = 'break-word';
    content.style.marginTop = '20px';
    content.textContent = 'Загрузка данных...';
    modal.appendChild(content);
    
    // Добавляем модальное окно в документ
    document.body.appendChild(modal);
    
    // Получаем данные
    const response = await fetch('/api/devices/debug/json');
    const json = await response.json();
    
    // Обновляем содержимое с отформатированным JSON
    content.textContent = JSON.stringify(json, null, 2);
    
    // Добавляем информацию о количестве устройств
    header.textContent = `Отладочная информация: ${json.length} устройств`;
    
    console.log('Отладочные данные в формате JSON загружены');
  } catch (error) {
    console.error('Ошибка при получении отладочных данных:', error);
    showError(`Ошибка при получении отладочных данных: ${error.message}`);
  }
}

// Переключение между разделами
document.addEventListener('DOMContentLoaded', function() {
  // Получаем ссылки меню
  const menuLinks = document.querySelectorAll('.top-menu a[data-section]');
  
  // Добавляем обработчик для каждой ссылки
  menuLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Получаем идентификатор секции из атрибута
      const sectionId = link.getAttribute('data-section');
      
      // Скрываем все секции
      const sections = document.querySelectorAll('.section-content');
      sections.forEach(section => {
        section.style.display = 'none';
      });
      
      // Показываем выбранную секцию
      const selectedSection = document.getElementById(`${sectionId}-section`);
      if (selectedSection) {
        selectedSection.style.display = 'block';
      }
      
      // Обновляем активный класс в меню
      menuLinks.forEach(item => {
        item.classList.remove('active');
      });
      link.classList.add('active');
      
      // Сохраняем выбранную вкладку в параметрах URL
      const url = new URL(window.location);
      url.searchParams.set('section', sectionId);
      window.history.pushState({}, '', url);
    });
  });
  
  // Проверяем, есть ли секция в URL при загрузке страницы
  const url = new URL(window.location);
  const sectionParam = url.searchParams.get('section');
  
  if (sectionParam) {
    // Активируем соответствующую вкладку
    const linkToActivate = document.querySelector(`.top-menu a[data-section="${sectionParam}"]`);
    if (linkToActivate) {
      linkToActivate.click();
    } else {
      // Если параметр не соответствует существующей вкладке, активируем первую
      const firstLink = document.querySelector('.top-menu a[data-section]');
      if (firstLink) firstLink.click();
    }
  } else {
    // Если параметр не указан, активируем первую вкладку
    const firstLink = document.querySelector('.top-menu a[data-section]');
    if (firstLink) firstLink.click();
  }
});

// Добавлено для совместимости: загрузка устройств в таблицу
async function displayApiDataInTable() {
  if (typeof loadDevices === 'function') {
    await loadDevices();
    return true;
  }
  return false;
} 