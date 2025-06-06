// Глобальные переменные
let allDevices = [];
let currentClientId = null;
let currentClient = null;
let currentPage = 1;
let itemsPerPage = 10;
let deviceModelsCache = [];
let isEditMode = false;
let selectedDevice = null;

// Получаем ID клиента из URL
function getClientIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

// Инициализация страницы
document.addEventListener('DOMContentLoaded', function() {
  currentClientId = getClientIdFromUrl();
  
  if (!currentClientId) {
    console.warn('ID клиента не указан в URL');
    // Не показываем ошибку, просто загружаем пустую страницу
  } else {
    // Загружаем данные клиента (опционально)
    loadClientInfo();
    // Загружаем устройства клиента
    loadClientDevices();
    // Загружаем ошибки клиента
    loadClientErrors();
  }
  
  // Настраиваем обработчики событий
  setupEventListeners();
  
  // Инициализируем модель устройств
  loadDeviceModelsCache();
});

// Загрузка информации о клиенте (опционально)
async function loadClientInfo() {
  try {
    const response = await fetch(`/api/users/${currentClientId}`);
    if (response.ok) {
      currentClient = await response.json();
      updateClientInfo();
    } else {
      console.warn('Клиент не найден, но продолжаем работу');
      document.getElementById('clientInfo').textContent = 'Неизвестный клиент';
    }
  } catch (error) {
    console.warn('Ошибка загрузки данных клиента:', error);
    document.getElementById('clientInfo').textContent = 'Неизвестный клиент';
  }
}

// Обновление информации о клиенте
function updateClientInfo() {
  if (!currentClient) {
    document.getElementById('clientInfo').textContent = 'Неизвестный клиент';
    return;
  }
  
  let infoText = currentClient.fio || 'Клиент';
  if (currentClient.workers && currentClient.workers.length > 0) {
    infoText += ` (воркеры: ${currentClient.workers.join(', ')})`;
  }
  
  document.getElementById('clientInfo').textContent = infoText;
}

// Загрузка устройств клиента
async function loadClientDevices() {
  try {
    showLoadingIndicator(true);
    
    let devices = [];
    if (currentClientId) {
      const response = await fetch(`/api/users/${currentClientId}/devices`);
      if (response.ok) {
        devices = await response.json();
      } else {
        console.error('Ошибка загрузки устройств:', response.status);
      }
    }
    
    allDevices = devices;
    
    updateDevicesStatistics();
    applyFilters();
    showLoadingIndicator(false);
    
  } catch (error) {
    console.error('Ошибка загрузки устройств:', error);
    showError('Ошибка загрузки устройств: ' + error.message);
    showLoadingIndicator(false);
  }
}

// Загрузка кэша моделей устройств
async function loadDeviceModelsCache() {
  try {
    const response = await fetch('/api/device-models');
    deviceModelsCache = await response.json();
  } catch (error) {
    console.error('Ошибка загрузки моделей устройств:', error);
    deviceModelsCache = [];
  }
}

// Инициализация селекта моделей устройств
function initDeviceModelSelect(selected = '') {
  const select = document.getElementById('deviceModel');
  if (!select) return;
  select.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Выберите модель...';
  select.appendChild(defaultOption);
  
  deviceModelsCache.forEach(model => {
    const option = document.createElement('option');
    option.value = model._id;
    option.textContent = model.name;
    if (selected && (selected === model._id || selected === model.name)) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  
  select.onchange = function() {
    const model = deviceModelsCache.find(m => m._id === this.value);
    if (model) {
      document.getElementById('deviceConsumption').value = model.consumption;
    }
  };
}

// Показать/скрыть индикатор загрузки
function showLoadingIndicator(show) {
  const indicator = document.getElementById('devicesLoadingIndicator');
  if (show) {
    indicator.classList.remove('d-none');
  } else {
    indicator.classList.add('d-none');
  }
}

// Показать ошибку
function showError(message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-danger alert-dismissible fade show';
  alertDiv.innerHTML = `
    <strong>Ошибка:</strong> ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  const container = document.querySelector('.container-lg');
  container.insertBefore(alertDiv, container.firstChild);
}

// Обновление статистики устройств
function updateDevicesStatistics() {
  const total = allDevices.length;
  const online = allDevices.filter(d => d.status === 'online' && !d.inRepair).length;
  const offline = allDevices.filter(d => d.status === 'offline' && !d.inRepair).length;
  const repair = allDevices.filter(d => d.inRepair).length;
  
  // Подсчет общего потребления - исправляем единицы измерения
  const totalConsumptionWatts = allDevices.reduce((sum, device) => {
    return sum + (device.consumption || 0);
  }, 0);
  
  document.getElementById('devicesCount').textContent = total;
  document.getElementById('devicesOnline').textContent = online;
  document.getElementById('devicesOffline').textContent = offline;
  document.getElementById('devicesRepair').textContent = repair;
  document.getElementById('totalConsumption').textContent = `${totalConsumptionWatts} Вт`;
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Фильтры
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('repairFilter').addEventListener('change', applyFilters);
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('itemsPerPage').addEventListener('change', function() {
    itemsPerPage = parseInt(this.value);
    currentPage = 1;
    applyFilters();
  });
  
  // Сброс фильтров
  document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
  
  // Кнопка добавления устройства
  const quickAddDeviceBtn = document.getElementById('quickAddDeviceBtn');
  if (quickAddDeviceBtn) {
    quickAddDeviceBtn.addEventListener('click', function(e) {
      prepareAddDeviceForm();
      const modalElement = document.getElementById('deviceModal');
      if (modalElement) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
        modalInstance.show();
      }
    });
  }
}

// Применение фильтров
function applyFilters() {
  const statusFilter = document.getElementById('statusFilter').value;
  const repairFilter = document.getElementById('repairFilter').value;
  const searchText = document.getElementById('searchInput').value.toLowerCase();
  
  let filteredDevices = allDevices.filter(device => {
    // Фильтр по статусу
    if (statusFilter === 'online' && (device.status !== 'online' || device.alert || device.inRepair)) {
      return false;
    }
    if (statusFilter === 'offline' && device.status === 'online' && !device.alert) {
      return false;
    }
    
    // Фильтр по ремонту
    if (repairFilter === 'inRepair' && !device.inRepair) {
      return false;
    }
    if (repairFilter === 'notInRepair' && device.inRepair) {
      return false;
    }
    
    // Поиск по тексту
    if (searchText) {
      const searchableText = [
        device.ip || '',
        device.worker || '',
        device.mac || '',
        device.name || '',
        device.model || ''
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchText)) {
        return false;
      }
    }
    
    return true;
  });
  
  // Сбрасываем на первую страницу при изменении фильтров
  currentPage = 1;
  
  renderDevices(filteredDevices);
  renderPagination(filteredDevices);
  updateFiltersIndicator();
}

// Сброс всех фильтров
function resetFilters() {
  document.getElementById('statusFilter').value = 'all';
  document.getElementById('repairFilter').value = 'all';
  document.getElementById('searchInput').value = '';
  currentPage = 1;
  applyFilters();
}

// Обновление индикатора активных фильтров
function updateFiltersIndicator() {
  const statusFilter = document.getElementById('statusFilter').value;
  const repairFilter = document.getElementById('repairFilter').value;
  const searchText = document.getElementById('searchInput').value;
  
  const hasActiveFilters = statusFilter !== 'all' || repairFilter !== 'all' || searchText.trim() !== '';
  
  const indicator = document.getElementById('filtersActiveMessage');
  if (hasActiveFilters) {
    indicator.classList.remove('d-none');
  } else {
    indicator.classList.add('d-none');
  }
}

// Отрисовка таблицы устройств (обновленная версия)
function renderDevices(filteredDevices) {
  const tbody = document.querySelector('#devicesTable tbody');
  const noDevicesMessage = document.getElementById('noDevicesMessage');
  
  if (noDevicesMessage) noDevicesMessage.classList.add('d-none');
  
  // Проверяем, есть ли устройства после фильтрации
  if (!filteredDevices || filteredDevices.length === 0) {
    tbody.innerHTML = '';
    if (noDevicesMessage) {
      noDevicesMessage.classList.remove('d-none');
      if (allDevices.length > 0) {
        noDevicesMessage.innerHTML = '<h5 class="alert-heading">Информация</h5><i class="bi bi-info-circle"></i> Нет устройств, соответствующих выбранным фильтрам.';
      } else {
        noDevicesMessage.innerHTML = '<h5 class="alert-heading">Информация</h5><i class="bi bi-info-circle"></i> У этого клиента пока нет устройств или они не найдены.';
      }
    }
    
    // Обновляем информацию о пагинации
    document.getElementById('paginationInfo').textContent = 'Показано 0-0 из 0 устройств';
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  
  if (noDevicesMessage) noDevicesMessage.classList.add('d-none');
  
  // Пагинация
  const totalItems = filteredDevices.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentDevices = filteredDevices.slice(startIndex, endIndex);
  
  // Обновляем информацию о пагинации
  const start = totalItems > 0 ? startIndex + 1 : 0;
  document.getElementById('paginationInfo').textContent = 
    `Показано ${start}-${endIndex} из ${totalItems} устройств`;
  
  // Отрисовка строк таблицы
  tbody.innerHTML = '';
  currentDevices.forEach(device => {
    const row = createDeviceRow(device);
    tbody.appendChild(row);
  });
}

// Создание строки устройства в таблице
function createDeviceRow(device) {
  const row = document.createElement('tr');
  
  // Определяем статус и цвет (используем тот же подход что и в оригинале)
  let statusClass, statusText;
  if (device.inRepair) {
    statusClass = 'text-warning';
    statusText = 'Ремонт';
  } else if (device.status !== 'online' || device.alert) {
    statusClass = 'text-danger';
    statusText = 'Не в сети';
  } else {
    statusClass = 'text-success';
    statusText = 'В сети';
  }
  
  // Форматируем время последней проверки
  const lastChecked = device.lastChecked ? 
    new Date(device.lastChecked).toLocaleString('ru-RU') : 'Никогда';
  
  row.innerHTML = `
    <td>${device.ip || 'Не указан'}</td>
    <td class="${statusClass}">${statusText}${device.alert ? ' (Ошибка)' : ''}</td>
    <td>${device.mac || 'Не указан'}</td>
    <td>${device.worker || 'Не указан'}</td>
    <td>${device.consumption ? `${device.consumption} Вт` : '-'}</td>
    <td>${lastChecked}</td>
    <td class="text-center align-middle" style="height: 56px;">
      <div class="form-check form-switch d-flex justify-content-center align-items-center" style="height:100%; margin-right:24px;">
        <input class="form-check-input" type="checkbox" style="margin-top:0;width:2.5em;height:1.5em;margin-left:0;margin-right:0;display:block;" ${device.enablePolling ? 'checked' : ''} ${device.inRepair ? 'disabled' : ''} onchange="toggleDeviceSetting('${device._id}', 'enablePolling', this.checked)">
      </div>
    </td>
    <td class="text-center align-middle" style="height: 56px;">
      <div class="form-check form-switch d-flex justify-content-center align-items-center" style="height:100%; margin-right:24px;">
        <input class="form-check-input" type="checkbox" style="margin-top:0;width:2.5em;height:1.5em;margin-left:0;margin-right:0;display:block;" ${device.inRepair ? 'checked' : ''} onchange="toggleDeviceSetting('${device._id}', 'inRepair', this.checked)">
      </div>
    </td>
    <td class="text-center align-middle">
      <button class="btn btn-sm btn-outline-primary me-1" onclick="showDeviceDetail('${device._id}')" title="Детали"><i class="bi bi-info-circle"></i></button>
      <button class="btn btn-sm btn-outline-success me-1" onclick="pingDevice('${device._id}')" title="Пинг"><i class="bi bi-wifi"></i></button>
    </td>
    <td class="text-center align-middle">
      <button class="btn btn-sm btn-outline-warning me-1" onclick="editDevice('${device._id}')" title="Редактировать"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-sm btn-outline-danger" onclick="deleteDevice('${device._id}')" title="Удалить"><i class="bi bi-trash"></i></button>
    </td>
  `;
  
  return row;
}

// Отрисовка пагинации (обновленная версия как в оригинале)
function renderPagination(filteredDevices) {
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
  const pagination = document.getElementById('pagination');
  
  // Генерируем страницы
  let paginationHTML = `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">&laquo;</a>
    </li>
  `;
  
  // Отображаем не более 5 страниц
  const maxPages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPages/2));
  let endPage = Math.min(totalPages, startPage + maxPages - 1);
  
  if (endPage - startPage + 1 < maxPages) {
    startPage = Math.max(1, endPage - maxPages + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `
      <li class="page-item ${i === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
      </li>
    `;
  }
  
  paginationHTML += `
    <li class="page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">&raquo;</a>
    </li>
  `;
  
  pagination.innerHTML = paginationHTML;
}

// Смена страницы (обновленная версия)
function changePage(page) {
  // Получаем текущие отфильтрованные устройства
  const statusFilter = document.getElementById('statusFilter').value;
  const repairFilter = document.getElementById('repairFilter').value;
  const searchText = document.getElementById('searchInput').value.toLowerCase();
  
  let filteredDevices = allDevices.filter(device => {
    // Фильтр по статусу
    if (statusFilter === 'online' && (device.status !== 'online' || device.alert || device.inRepair)) {
      return false;
    }
    if (statusFilter === 'offline' && device.status === 'online' && !device.alert) {
      return false;
    }
    
    // Фильтр по ремонту
    if (repairFilter === 'inRepair' && !device.inRepair) {
      return false;
    }
    if (repairFilter === 'notInRepair' && device.inRepair) {
      return false;
    }
    
    // Поиск по тексту
    if (searchText) {
      const searchableText = [
        device.ip || '',
        device.worker || '',
        device.mac || '',
        device.name || '',
        device.model || ''
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchText)) {
        return false;
      }
    }
    
    return true;
  });
  
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  renderDevices(filteredDevices);
  renderPagination(filteredDevices);
}

// Переключение настроек устройства (опрос/ремонт)
async function toggleDeviceSetting(deviceId, setting, value) {
  try {
    const response = await fetch(`/api/devices/${deviceId}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ [setting]: value })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }
    
    const updatedDevice = await response.json();
    
    // Обновляем устройство в локальном массиве
    const deviceIndex = allDevices.findIndex(d => d._id === deviceId);
    if (deviceIndex !== -1) {
      allDevices[deviceIndex] = { ...allDevices[deviceIndex], ...updatedDevice };
      updateDevicesStatistics();
      applyFilters();
    }
    
  } catch (error) {
    console.error(`Ошибка обновления настройки ${setting}:`, error);
    
    // Возвращаем переключатель обратно при ошибке
    const switches = document.querySelectorAll('input[type="checkbox"]');
    switches.forEach(switchEl => {
      const row = switchEl.closest('tr');
      if (row && row.querySelector('button[onclick*="' + deviceId + '"]')) {
        if (setting === 'enablePolling' && switchEl.onchange.toString().includes('enablePolling')) {
          switchEl.checked = !value;
        } else if (setting === 'inRepair' && switchEl.onchange.toString().includes('inRepair')) {
          switchEl.checked = !value;
        }
      }
    });
    
    showError(`Ошибка обновления настройки: ${error.message}`);
  }
}

// Показать детальную информацию об устройстве (используем оригинальную реализацию)
async function showDeviceDetail(deviceId) {
  try {
    const device = allDevices.find(d => d._id === deviceId);
    if (!device) return;

    // Открываем модальное окно
    const modalElement = document.getElementById('deviceDetailModal');
    const infoBlock = document.getElementById('deviceDetailInfoBlock');
    const loadingIndicator = document.getElementById('deviceDetailLoadingIndicator');
    if (!modalElement || !infoBlock || !loadingIndicator) return;
    infoBlock.innerHTML = '';
    loadingIndicator.classList.remove('d-none');
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    modalInstance.show();

    // Формируем подробную таблицу
    const rows = [
      { label: 'IP адрес', value: device.ip },
      { label: 'MAC адрес', value: device.mac || '-' },
      { label: 'Серийный номер', value: device.serialNumber || '-' },
      { label: 'Воркер', value: device.worker || '-' },
      { label: 'Потребление', value: device.consumption ? `${device.consumption} Вт` : '-' },
      { label: 'Модель', value: device.model || '-' },
      { label: 'Количество карт', value: device.cards || '-' },
      { label: 'Статус', value: device.status === 'online' ? 'Online' : 'Offline' },
      { label: 'В ремонте', value: device.inRepair ? 'Да' : 'Нет' },
      { label: 'Опрос включен', value: device.enablePolling ? 'Да' : 'Нет' },
      { label: 'Последняя проверка', value: device.lastChecked ? new Date(device.lastChecked).toLocaleString() : '-' },
      { label: 'Ошибка', value: device.alert || '-' },
      { label: 'Комментарий', value: device.comment || '-' }
    ];
    infoBlock.innerHTML = `<table class="table table-bordered mb-0">
      <tbody>
        ${rows.map(row => `<tr><th>${row.label}</th><td>${row.value}</td></tr>`).join('')}
      </tbody>
    </table>`;
    loadingIndicator.classList.add('d-none');
  } catch (error) {
    console.error('Ошибка при отображении деталей устройства:', error);
    const infoBlock = document.getElementById('deviceDetailInfoBlock');
    if (infoBlock) infoBlock.innerHTML = `<div class="alert alert-danger">Ошибка загрузки данных: ${error.message}</div>`;
  }
}

// Пинг устройства (исправленная версия без изменения статуса)
async function pingDevice(deviceId) {
  const device = allDevices.find(d => d._id === deviceId);
  if (!device) return;
  
  try {
    const pingButton = document.querySelector(`button[onclick="pingDevice('${deviceId}')"]`);
    pingButton.disabled = true;
    pingButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
    
    const response = await fetch(`/api/devices/${deviceId}/ping`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Ошибка при пинге устройства');
    }
    
    const result = await response.json();
    
    // Показываем результат через уведомление, но не меняем статус устройства в таблице
    if (result.status === 'online') {
      showNotification(`Устройство ${result.ip} доступно (${result.pingTime}ms)`, 'success');
      pingButton.classList.remove('btn-outline-success', 'btn-outline-danger');
      pingButton.classList.add('btn-success');
      setTimeout(() => {
        pingButton.classList.remove('btn-success');
        pingButton.classList.add('btn-outline-success');
      }, 1000);
    } else {
      showNotification(`Устройство ${result.ip} недоступно`, 'danger');
      pingButton.classList.remove('btn-outline-success', 'btn-outline-danger');
      pingButton.classList.add('btn-danger');
      setTimeout(() => {
        pingButton.classList.remove('btn-danger');
        pingButton.classList.add('btn-outline-success');
      }, 1000);
    }
    
    // Перезагружаем устройства для обновления данных (но не перерисовываем таблицу полностью)
    await loadClientDevices();
    
  } catch (error) {
    console.error('Ошибка при пинге устройства:', error);
    showNotification(`Ошибка проверки связи: ${error.message}`, 'danger');
    const pingButton = document.querySelector(`button[onclick="pingDevice('${deviceId}')"]`);
    if (pingButton) {
      pingButton.classList.remove('btn-outline-success', 'btn-outline-danger');
      pingButton.classList.add('btn-danger');
      setTimeout(() => {
        pingButton.classList.remove('btn-danger');
        pingButton.classList.add('btn-outline-success');
      }, 1000);
    }
  } finally {
    const pingButton = document.querySelector(`button[onclick="pingDevice('${deviceId}')"]`);
    if (pingButton) {
      pingButton.disabled = false;
      pingButton.innerHTML = '<i class="bi bi-wifi"></i>';
    }
  }
}

// Загрузка ошибок клиента
async function loadClientErrors() {
  try {
    showErrorsLoadingIndicator(true);
    
    let clientErrors = [];
    if (currentClient && currentClient.workers && currentClient.workers.length > 0) {
      // Получаем базовые части воркеров клиента
      const workerBases = currentClient.workers.map(worker => {
        const parts = worker.split('.');
        return parts[0]; // Берем часть до первой точки
      });
      
      // Загружаем все ошибки
      const response = await fetch('/api/errors');
      if (response.ok) {
        const allErrors = await response.json();
        // Фильтруем ошибки по воркерам клиента
        clientErrors = allErrors.filter(error => {
          if (!error.worker) return false;
          return workerBases.some(base => error.worker.startsWith(base + '.'));
        });
      }
    }
    
    // Обновляем счетчик ошибок
    document.getElementById('errorsCount').textContent = clientErrors.length;
    
    // Показываем/скрываем алерты
    updateErrorsIndicators(clientErrors.length);
    showErrorsLoadingIndicator(false);
    
  } catch (error) {
    console.error('Ошибка загрузки ошибок клиента:', error);
    document.getElementById('errorsCount').textContent = '?';
    showErrorsLoadingIndicator(false);
  }
}

// Обновление индикаторов ошибок
function updateErrorsIndicators(errorsCount) {
  const errorsActiveMsg = document.getElementById('errorsActiveMessage');
  
  // Показываем алерт только если есть ошибки
  if (errorsCount > 0) {
    errorsActiveMsg.classList.remove('d-none');
  } else {
    errorsActiveMsg.classList.add('d-none');
  }
}

// Показать/скрыть индикатор загрузки ошибок
function showErrorsLoadingIndicator(show) {
  const indicator = document.getElementById('errorsLoadingIndicator');
  if (show) {
    indicator.classList.remove('d-none');
  } else {
    indicator.classList.add('d-none');
  }
}

// Реальные функции редактирования и удаления устройств (заменяем заглушки)
function editDevice(deviceId) {
  isEditMode = true;
  try {
    const device = allDevices.find(d => d._id === deviceId);
    if (!device) return;
    selectedDevice = device;
    
    // Заполняем select моделей
    initDeviceModelSelect((device && device.model && device.model._id) ? device.model._id : device?.model || '');
    
    const modalTitle = document.getElementById('deviceModalTitle');
    const deviceIp = document.getElementById('deviceIp');
    const deviceMac = document.getElementById('deviceMac');
    const deviceSerial = document.getElementById('deviceSerial');
    const deviceWorker = document.getElementById('deviceWorker');
    const deviceModel = document.getElementById('deviceModel');
    const deviceConsumption = document.getElementById('deviceConsumption');
    const deviceCards = document.getElementById('deviceCards');
    const deviceComment = document.getElementById('deviceComment');
    const saveDeviceBtn = document.getElementById('saveDeviceBtn');
    
    if (modalTitle) modalTitle.textContent = 'Редактировать устройство';
    if (deviceIp) deviceIp.value = device.ip;
    if (deviceMac) deviceMac.value = device.mac || '';
    if (deviceSerial) deviceSerial.value = device.serialNumber || '';
    if (deviceWorker) deviceWorker.value = device.worker || '';
    if (deviceModel) deviceModel.value = (device.model && device.model._id) ? device.model._id : device.model || '';
    if (deviceConsumption) deviceConsumption.value = device.consumption || '';
    if (deviceCards) deviceCards.value = device.cards || '';
    if (deviceComment) deviceComment.value = device.comment || '';
    if (saveDeviceBtn) saveDeviceBtn.dataset.mode = 'edit';
    
    // Устанавливаем значения чекбоксов
    const devicePolling = document.getElementById('devicePolling');
    const deviceRepair = document.getElementById('deviceRepair');
    if (devicePolling) devicePolling.checked = device.enablePolling !== false;
    if (deviceRepair) deviceRepair.checked = device.inRepair === true;
    
    // Открываем модальное окно
    const modalElement = document.getElementById('deviceModal');
    if (modalElement) {
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
      modalInstance.show();
    }
  } catch (error) {
    console.error('Ошибка открытия модального окна редактирования:', error);
  }
}

async function deleteDevice(deviceId) {
  const device = allDevices.find(d => d._id === deviceId);
  if (!device) return;
  
  if (!confirm(`Вы уверены, что хотите удалить устройство ${device.ip}?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/devices/${deviceId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Ошибка при удалении устройства');
    }
    
    // Удаляем устройство из массива
    const index = allDevices.findIndex(d => d._id === deviceId);
    if (index !== -1) {
      allDevices.splice(index, 1);
    }
    
    showNotification('Устройство успешно удалено', 'success');
    
    // Обновляем отображение
    updateDevicesStatistics();
    applyFilters();
    
  } catch (error) {
    console.error('Ошибка при удалении устройства:', error);
    showNotification(`Не удалось удалить устройство: ${error.message}`, 'danger');
  }
}

// Сохранение устройства
async function saveDevice() {
  try {
    const form = document.getElementById('deviceForm');
    if (!form || !form.checkValidity()) {
      if (form) form.classList.add('was-validated');
      return;
    }
    
    const mode = document.getElementById('saveDeviceBtn')?.dataset.mode;
    const deviceData = {
      ip: document.getElementById('deviceIp')?.value.trim() || '',
      mac: document.getElementById('deviceMac')?.value.trim() || '',
      serialNumber: document.getElementById('deviceSerial')?.value.trim() || '',
      worker: document.getElementById('deviceWorker')?.value.trim() || '',
      model: document.getElementById('deviceModel')?.value || '',
      consumption: parseFloat(document.getElementById('deviceConsumption')?.value) || 0,
      cards: parseInt(document.getElementById('deviceCards')?.value, 10) || 0,
      comment: document.getElementById('deviceComment')?.value.trim() || '',
      enablePolling: document.getElementById('devicePolling')?.checked || false,
      inRepair: document.getElementById('deviceRepair')?.checked || false
    };
    
    // Проверка: MAC обязателен
    if (!deviceData.mac) {
      showNotification('MAC-адрес обязателен!', 'danger');
      return;
    }
    
    try {
      if (mode === 'add') {
        const response = await fetch('/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deviceData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Ошибка при добавлении устройства');
        }
        
        const addedDevice = await response.json();
        allDevices.push(addedDevice);
        showNotification('Устройство успешно добавлено', 'success');
      } else {
        // При редактировании передаем ID устройства
        deviceData._id = selectedDevice._id;
        
        const response = await fetch(`/api/devices/${deviceData._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deviceData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Ошибка при обновлении устройства');
        }
        
        const updatedDevice = await response.json();
        
        // Обновляем устройство в массиве
        const index = allDevices.findIndex(d => d._id === updatedDevice._id);
        if (index !== -1) {
          allDevices[index] = updatedDevice;
        }
        
        showNotification('Устройство успешно обновлено', 'success');
      }
      
      // Закрываем модальное окно
      const modalElement = document.getElementById('deviceModal');
      if (modalElement) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
        modalInstance.hide();
      }
      
      // Обновляем отображение
      updateDevicesStatistics();
      applyFilters();
      
    } catch (error) {
      if (error.message.includes('уже существует')) {
        showNotification('Устройство с такими данными уже существует в базе данных', 'danger');
      } else {
        showNotification(`Не удалось сохранить устройство: ${error.message}`, 'danger');
      }
      console.error('Ошибка при сохранении устройства:', error);
    }
  } catch (error) {
    console.error('Ошибка при подготовке данных устройства:', error);
    showNotification('Произошла ошибка при обработке формы', 'danger');
  }
}

// Подготовка формы для добавления нового устройства
function prepareAddDeviceForm() {
  const form = document.getElementById('deviceForm');
  if (form) form.reset();
  selectedDevice = null;
  isEditMode = false;
  
  const saveDeviceBtn = document.getElementById('saveDeviceBtn');
  if (saveDeviceBtn) {
    saveDeviceBtn.dataset.mode = 'add';
    delete saveDeviceBtn.dataset.id;
  }
  
  // Сбросить все поля
  initDeviceModelSelect();
  const devicePolling = document.getElementById('devicePolling');
  const deviceRepair = document.getElementById('deviceRepair');
  if (devicePolling) devicePolling.checked = true;
  if (deviceRepair) deviceRepair.checked = false;
  
  // Меняем заголовок модалки
  const modalTitle = document.getElementById('deviceModalTitle');
  if (modalTitle) modalTitle.textContent = 'Добавить устройство';
}

// Экспортируем функции в глобальную область видимости
window.toggleDeviceSetting = toggleDeviceSetting;
window.showDeviceDetail = showDeviceDetail;
window.pingDevice = pingDevice;
window.changePage = changePage;
window.editDevice = editDevice;
window.deleteDevice = deleteDevice;
window.saveDevice = saveDevice;
window.prepareAddDeviceForm = prepareAddDeviceForm;

// Показать уведомление
function showNotification(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
  alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(alertDiv);
  
  // Автоматически скрываем через 3 секунды
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 3000);
} 