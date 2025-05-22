// Переменные для работы с устройствами
let allDevices = [];
let filteredDevices = [];
let currentPage = 1;
let itemsPerPage = 10;
let deviceModal;
let deviceInfoModal;
let deviceHistoryModal;
let deviceDetailOffcanvas;
let chart;
let devices = [];
let selectedDevice = null;
let newDeviceCount = 0;
let deviceModelsCache = [];
let isLoadingDevices = false;
let isEditMode = false;

async function loadDeviceModelsCache() {
  const res = await fetch('/api/device-models');
  deviceModelsCache = await res.json();
}

// Инициализация модульных элементов при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  // Инициализируем модальное окно для графика
  const historyModalElement = document.getElementById('deviceHistoryModal');
  if (historyModalElement) {
    deviceHistoryModal = new bootstrap.Modal(historyModalElement);
  }
  
  // Инициализируем модальное окно для информации о устройстве
  const infoModalElement = document.getElementById('deviceInfoModal');
  if (infoModalElement) {
    deviceInfoModal = new bootstrap.Modal(infoModalElement);
  }
  
  // Инициализируем нижнюю панель для деталей устройства
  const detailOffcanvasElement = document.getElementById('deviceDetailOffcanvas');
  if (detailOffcanvasElement) {
    deviceDetailOffcanvas = new bootstrap.Offcanvas(detailOffcanvasElement);
  }
  
  // События фильтрации
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('repairFilter').addEventListener('change', applyFilters);
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('itemsPerPage').addEventListener('change', changeItemsPerPage);
  
  // Обработчик кнопки сброса фильтров
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', resetAllFilters);
  }
  
  // Загружаем устройства при наличии таблицы устройств
  const devicesTable = document.getElementById('devicesTable');
  if (devicesTable) {
    loadDevices();
  }
  
  // Инициализируем обработчики форм для работы с устройствами
  const addDeviceForm = document.getElementById('addDeviceForm');
  if (addDeviceForm) {
    addDeviceForm.addEventListener('submit', function(e) {
      e.preventDefault();
      addDevice();
    });
  }
  
  const scanDevicesForm = document.getElementById('scanDevicesForm');
  if (scanDevicesForm) {
    scanDevicesForm.addEventListener('submit', function(e) {
      e.preventDefault();
      scanDevices();
    });
  }
  
  // Навешиваем обработчик на кнопку 'Добавить' только для предварительной настройки формы
  const addDeviceBtn = document.getElementById('addDeviceBtn');
  if (addDeviceBtn) {
    addDeviceBtn.addEventListener('click', function(e) {
      isEditMode = false;
      prepareAddDeviceForm();
    });
  }

  const scanBtn = document.querySelector('button[data-bs-target="#scanDevicesModal"]');
  if (scanBtn) {
    scanBtn.addEventListener('click', function(e) {
      e.preventDefault();
      const scanModal = new bootstrap.Modal(document.getElementById('scanDevicesModal'));
      scanModal.show();
    });
  }

  // Добавляем обработчик на событие показа модального окна
  const deviceModalEl = document.getElementById('deviceModal');
  if (deviceModalEl) {
    deviceModalEl.addEventListener('show.bs.modal', function(e) {
      if (!isEditMode) {
        initDeviceModelSelect('');
      }
    });
  }

  // Фильтр по названию
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', renderDevices);
  }

  // Сохранение устройства
  // const deviceForm = document.getElementById('deviceForm');
  // if (deviceForm) {
  //   deviceForm.addEventListener('submit', async function(e) {
  //     e.preventDefault();
  //     const name = document.getElementById('deviceName').value.trim();
  //     const model = document.getElementById('deviceModel').value;
  //     const consumption = parseFloat(document.getElementById('deviceConsumption').value);
  //     if (!name || !model || isNaN(consumption)) return;
  //     try {
  //       const res = await fetch('/api/devices', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ name, model, consumption })
  //       });
  //       if (!res.ok) {
  //         const data = await res.json();
  //         alert(data.error || 'Ошибка при добавлении устройства');
  //         return;
  //       }
  //       await loadDevices();
  //       const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('deviceModal'));
  //       modal.hide();
  //     } catch (err) {
  //       alert('Ошибка сети при добавлении устройства');
  //     }
  //   });
  // }

  // Первичное обновление данных
  setTimeout(updateAllStats, 1000);

  // Загрузка устройств с сервера
async function loadDevices() {
  isLoadingDevices = true;
  renderDevices();
  // Сначала загрузить модели, если кэш пуст
  if (!deviceModelsCache || !deviceModelsCache.length) {
    await loadDeviceModelsCache();
  }
  const res = await fetch('/api/devices/full');
  const data = await res.json();
  window.devices = data;
  allDevices = data;
  devices = data;
  isLoadingDevices = false;
  renderDevices();
}

function initDeviceModelSelect(selected = '') {
  const select = document.getElementById('deviceModel');
  if (!select) return;
  select.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Выберите модель...';
  select.appendChild(defaultOption);
  fetch('/api/device-models').then(r=>r.json()).then(models => {
    // Для отладки
    console.log('Заполняю select моделей', models);
    // Убираем дубли по имени
    const uniqueModels = [];
    const seenNames = new Set();
    models.forEach(m => {
      if (!seenNames.has(m.name)) {
        uniqueModels.push(m);
        seenNames.add(m.name);
      }
    });
    deviceModelsCache = uniqueModels;
    uniqueModels.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m._id;
      opt.textContent = m.name;
      if (selected && (selected === m._id || selected === m.name)) opt.selected = true;
      select.appendChild(opt);
    });
    // Для отладки
    console.log('Селект после заполнения:', select.innerHTML, 'Количество опций:', select.options.length);
    select.onchange = function() {
      const model = deviceModelsCache.find(m => m._id === this.value);
      if (model) document.getElementById('deviceConsumption').value = model.consumption;
    };
  });
}
window.initDeviceModelSelect = initDeviceModelSelect;

// Обновление статистики устройств
function updateDevicesStatistics() {
  // Всего устройств
  if (document.getElementById('devicesCount')) document.getElementById('devicesCount').textContent = devices.length;
  
  // Количество онлайн
  const onlineCount = devices.filter(d => d.status === 'online').length;
  if (document.getElementById('devicesOnline')) document.getElementById('devicesOnline').textContent = onlineCount;
  
  // Количество оффлайн
  const offlineCount = devices.filter(d => d.status === 'offline' || d.status === 'unreachable').length;
  if (document.getElementById('devicesOffline')) document.getElementById('devicesOffline').textContent = offlineCount;
  
  // Количество в ремонте
  const repairCount = devices.filter(d => d.inRepair).length;
  if (document.getElementById('devicesRepair')) document.getElementById('devicesRepair').textContent = repairCount;
  
  // Обновляем общее потребление
  updateTotalConsumption();
}

// Отображение списка устройств для селекта
function renderDevicesList() {
  const devicesList = document.getElementById('reportDevice');
  if (!devicesList) return;
  
  // Сохраняем первую опцию "Все устройства"
  const allOption = devicesList.querySelector('option[value="all"]');
  devicesList.innerHTML = '';
  
  if (allOption) {
    devicesList.appendChild(allOption);
  }
  
  if (devices && devices.length > 0) {
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device._id;
      option.textContent = device.name ? `${device.name} (${device.ip})` : device.ip;
      devicesList.appendChild(option);
    });
  } else {
    const option = document.createElement('option');
    option.disabled = true;
    option.textContent = 'Нет доступных устройств';
    devicesList.appendChild(option);
  }
}

// Открытие панели редактирования устройства (заменяет функцию openAddDeviceModal)
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
    // Открываем модальное окно по центру
    const modalElement = document.getElementById('deviceModal');
    if (modalElement) {
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
      modalInstance.show();
    }
  } catch (error) {
    console.error('Ошибка открытия модального окна редактирования:', error);
  }
}
window.editDevice = editDevice;

// Сохранение устройства (добавление или обновление)
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
      showError('MAC-адрес обязателен!');
      return;
    }
    
    try {
      if (mode === 'add') {
        const addedDevice = await addDevice(deviceData);
        // Добавляем новое устройство в массив устройств
        allDevices.push(addedDevice);
        showSuccess('Устройство успешно добавлено');
      } else {
        // При редактировании передаем ID устройства
        deviceData._id = selectedDevice._id;
        const updatedDevice = await updateDevice(deviceData);
        
        // Обновляем устройство в массиве без перезагрузки всего списка
        const index = allDevices.findIndex(d => d._id === updatedDevice._id);
        if (index !== -1) {
          allDevices[index] = updatedDevice;
        }
        
        showSuccess('Устройство успешно обновлено');
        // Закрываю модальное окно после сохранения
        const modalElement = document.getElementById('deviceModal');
        if (modalElement) {
          const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
          modalInstance.hide();
        }
      }
      
      // Закрываем панель offcanvas
      const offcanvasElement = document.getElementById('deviceOffcanvas');
      if (offcanvasElement) {
        const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasElement);
        if (offcanvasInstance) offcanvasInstance.hide();
      }
      
      // Обновляем фильтрованный массив и отображение таблицы
      applyFilters();
      updateDevicesStatistics();
    } catch (error) {
      if (error.message.includes('Устройство с таким IP уже существует')) {
        showError('Устройство с таким IP-адресом уже существует в базе данных. Устройство может быть скрыто текущими фильтрами. Нажмите кнопку сброса фильтров, чтобы увидеть все устройства.');
        // Автоматически ищем устройство с таким IP
        if (deviceData.ip) {
          resetFiltersAndSearchByIp(deviceData.ip);
        }
      } else {
        showError('Не удалось сохранить устройство. Попробуйте позже.');
      }
      console.error('Ошибка при сохранении устройства:', error);
    }
  } catch (error) {
    console.error('Ошибка при подготовке данных устройства:', error);
    showError('Произошла ошибка при обработке формы.');
  }
}
window.saveDevice = saveDevice;

// Удаление устройства
async function deleteDevice(deviceId) {
  const device = allDevices.find(d => d._id === deviceId);
  if (!device) return;
  
  if (!confirm(`Вы уверены, что хотите удалить устройство ${device.ip}?`)) {
    return;
  }
  
  try {
    await removeDevice(deviceId);
    
    // Удаляем устройство из массива без перезагрузки всего списка
    const index = allDevices.findIndex(d => d._id === deviceId);
    if (index !== -1) {
      allDevices.splice(index, 1);
    }
    
    showSuccess('Устройство успешно удалено');
    
    // Обновляем фильтрованный массив и отображение таблицы
    applyFilters();
    updateDevicesStatistics();
  } catch (error) {
    console.error('Ошибка при удалении устройства:', error);
    showError('Не удалось удалить устройство. Попробуйте позже.');
  }
}
window.deleteDevice = deleteDevice;

// API-функции для работы с устройствами
async function addDevice(deviceData) {
  const response = await fetch('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deviceData)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Ошибка при добавлении устройства');
  }
  
  return response.json();
}

async function updateDevice(deviceData) {
  const response = await fetch(`/api/devices/${deviceData._id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deviceData)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Ошибка при обновлении устройства');
  }
  
  return response.json();
}

async function removeDevice(deviceId) {
  const response = await fetch(`/api/devices/${deviceId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Ошибка при удалении устройства');
  }
  
  return response.json();
}

// Показать информацию об устройстве
function showDeviceInfo(deviceId) {
  showDeviceDetail(deviceId);
}

// Отображение графика истории устройства
async function showHistory(deviceId) {
  showDeviceDetail(deviceId);
}

// Объединенная функция для отображения деталей устройства в нижней панели
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
window.showDeviceDetail = showDeviceDetail;

// Пинг устройства
async function pingDevice(deviceId) {
  const device = allDevices.find(d => d._id === deviceId);
  if (!device) return;
  
  try {
    const pingButton = document.querySelector(`button[onclick="pingDevice('${deviceId}')"]`);
    pingButton.disabled = true;
    
    const response = await fetch(`/api/devices/${deviceId}/ping`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Ошибка при пинге устройства');
    }
    
    const result = await response.json();
    
    if (result.status === 'online') {
      pingButton.classList.remove('btn-outline-success', 'btn-outline-danger');
      pingButton.classList.add('btn-success');
      setTimeout(() => {
        pingButton.classList.remove('btn-success');
        pingButton.classList.add('btn-outline-success');
      }, 1000);
    } else {
      pingButton.classList.remove('btn-outline-success', 'btn-outline-danger');
      pingButton.classList.add('btn-danger');
      setTimeout(() => {
        pingButton.classList.remove('btn-danger');
        pingButton.classList.add('btn-outline-success');
      }, 1000);
    }
  } catch (error) {
    console.error('Ошибка при пинге устройства:', error);
    pingButton.classList.remove('btn-outline-success', 'btn-outline-danger');
    pingButton.classList.add('btn-danger');
    setTimeout(() => {
      pingButton.classList.remove('btn-danger');
      pingButton.classList.add('btn-outline-success');
    }, 1000);
  } finally {
    const pingButton = document.querySelector(`button[onclick="pingDevice('${deviceId}')"]`);
    if (pingButton) {
      pingButton.disabled = false;
      pingButton.innerHTML = '<i class="bi bi-wifi"></i>';
    }
  }
}
window.pingDevice = pingDevice;

async function scanNetworkDevices(scanData) {
  // Создаем EventSource для получения обновлений в реальном времени
  return new Promise((resolve, reject) => {
    const scanStartEvent = new CustomEvent('scanStart', { 
      detail: { startIp: scanData.startIp, endIp: scanData.endIp } 
    });
    window.dispatchEvent(scanStartEvent);
    
    const eventSource = new EventSource(`/api/devices/scan?startIp=${scanData.startIp}&endIp=${scanData.endIp}`);
    
    eventSource.onmessage = function(event) {
      const data = JSON.parse(event.data);
      
      if (data.progress !== undefined) {
        scanData.onProgress(data.progress, data.newDevices || 0);
      }
      
      if (data.complete) {
        eventSource.close();
        resolve(data);
      }
    };
    
    eventSource.onerror = function() {
      eventSource.close();
      reject(new Error('Соединение с сервером прервано'));
    };
    
    // Таймаут на случай, если сканирование зависнет
    setTimeout(() => {
      if (eventSource.readyState !== 2) { // 2 = CLOSED
        eventSource.close();
        reject(new Error('Превышено время ожидания сканирования'));
      }
    }, 300000); // 5 минут
  });
}

// Применить фильтры к списку устройств
function applyFilters() {
  const statusFilter = document.getElementById('statusFilter').value;
  const repairFilter = document.getElementById('repairFilter').value;
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  
  // Проверяем, активны ли какие-либо фильтры
  const areFiltersActive = statusFilter !== 'all' || repairFilter !== 'all' || searchTerm.length > 0;
  const filtersActiveMessage = document.getElementById('filtersActiveMessage');
  
  if (filtersActiveMessage) {
    if (areFiltersActive) {
      filtersActiveMessage.classList.remove('d-none');
    } else {
      filtersActiveMessage.classList.add('d-none');
    }
  }
  
  // Применяем фильтры
  filteredDevices = allDevices.filter(device => {
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
    
    // Поиск по IP, имени, воркеру
    if (searchTerm) {
      const searchFields = [
        device.ip,
        device.name,
        device.worker,
        device.serialNumber,
        device.model
      ].filter(Boolean).map(f => f.toLowerCase());
      
      return searchFields.some(field => field.includes(searchTerm));
    }
    
    return true;
  });
  
  // Сбрасываем на первую страницу при изменении фильтров
  currentPage = 1;
  renderPagination();
  renderDevices();
}

// Отрисовка панели пагинации
function renderPagination() {
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
  const pagination = document.getElementById('pagination');
  
  // Информация о текущей странице
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, filteredDevices.length);
  document.getElementById('paginationInfo').textContent = 
    `Показано ${filteredDevices.length ? start : 0}-${end} из ${filteredDevices.length} устройств`;
  
  // Генерируем страницы
  let paginationHTML = `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="goToPage(${currentPage - 1}); return false;">&laquo;</a>
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
        <a class="page-link" href="#" onclick="goToPage(${i}); return false;">${i}</a>
      </li>
    `;
  }
  
  paginationHTML += `
    <li class="page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="goToPage(${currentPage + 1}); return false;">&raquo;</a>
    </li>
  `;
  
  pagination.innerHTML = paginationHTML;
}

// Переход на указанную страницу
function goToPage(page) {
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  renderPagination();
  renderDevices();
}

// Изменение количества элементов на странице
function changeItemsPerPage() {
  itemsPerPage = parseInt(document.getElementById('itemsPerPage').value);
  currentPage = 1;
  renderPagination();
  renderDevices();
}

// Функция для форматирования времени простоя
function formatDowntime(minutes) {
  if (!minutes || minutes <= 0) return '-';
  
  if (minutes < 60) {
    return `${minutes} мин`;
  } else if (minutes < 1440) { // меньше 24 часов
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} ч ${mins > 0 ? mins + ' мин' : ''}`;
  } else { // больше или равно 24 часам
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return `${days} д ${hours > 0 ? hours + ' ч' : ''}`;
  }
}

// Функция для расчета общего времени простоя
function calculateTotalDowntime(device) {
  if (!device.events || device.events.length === 0) return 0;
  
  let totalDowntimeMinutes = 0;
  let inDowntime = false;
  let downtimeStart = null;
  
  // Сортируем события по времени (от старых к новым)
  const sortedEvents = [...device.events].sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  );
  
  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    
    // Если это событие офлайн (status = 1) и мы не находимся в периоде простоя
    if (event.status === 1 && !inDowntime) {
      inDowntime = true;
      downtimeStart = new Date(event.timestamp);
    }
    // Если это событие онлайн (status = 0) и мы находимся в периоде простоя
    else if (event.status === 0 && inDowntime) {
      inDowntime = false;
      const downtimeEnd = new Date(event.timestamp);
      const downtimeMinutes = Math.floor((downtimeEnd - downtimeStart) / (1000 * 60));
      totalDowntimeMinutes += downtimeMinutes;
    }
  }
  
  // Если устройство сейчас в простое, добавляем время до текущего момента
  if (inDowntime) {
    const now = new Date();
    const currentDowntimeMinutes = Math.floor((now - downtimeStart) / (1000 * 60));
    totalDowntimeMinutes += currentDowntimeMinutes;
  }
  
  // Если устройство сейчас offline или в ремонте, считаем это текущим простоем
  if ((device.status === 'offline' || device.inRepair) && !inDowntime) {
    const lastEvent = device.events[device.events.length - 1];
    if (lastEvent) {
      const lastEventTime = new Date(lastEvent.timestamp);
      const currentDowntimeMinutes = Math.floor((new Date() - lastEventTime) / (1000 * 60));
      totalDowntimeMinutes += currentDowntimeMinutes;
    }
  }
  
  return totalDowntimeMinutes;
}

// Отображение отфильтрованных устройств в таблице
function renderDevices() {
  const tbody = document.querySelector('#devicesTable tbody');
  const noDevicesMessage = document.getElementById('noDevicesMessage');
  if (noDevicesMessage) noDevicesMessage.classList.add('d-none');

  if (isLoadingDevices) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center"><span class="spinner-border spinner-border-sm me-2"></span>Загрузка...</td></tr>';
    return;
  }

  if (!filteredDevices || filteredDevices.length === 0) {
    tbody.innerHTML = '';
    if (noDevicesMessage) {
      noDevicesMessage.classList.remove('d-none');
      if (allDevices.length > 0) {
        noDevicesMessage.innerHTML = '<i class="bi bi-info-circle"></i> Нет устройств, соответствующих выбранным фильтрам.';
      } else {
        noDevicesMessage.innerHTML = '<i class="bi bi-info-circle"></i> Устройства не найдены. Добавьте новые устройства или просканируйте сеть.';
      }
    }
    return;
  }
  if (noDevicesMessage) noDevicesMessage.classList.add('d-none');
  const start = (currentPage - 1) * itemsPerPage;
  const paginatedDevices = filteredDevices.slice(start, start + itemsPerPage);
  tbody.innerHTML = paginatedDevices.map(device => {
    // Определяем статус устройства
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
    const lastSeen = device.lastChecked ? new Date(device.lastChecked).toLocaleString() : 'Никогда';
    const downtimeMinutes = calculateTotalDowntime(device);
    const formattedDowntime = formatDowntime(downtimeMinutes);
    // Подсветка потребления, если отличается от дефолтного
    let consumptionClass = '';
    let modelDefault = null;
    if (device.model && deviceModelsCache && deviceModelsCache.length) {
      if (typeof device.model === 'object' && device.model._id) {
        modelDefault = deviceModelsCache.find(m => m._id === device.model._id);
      } else {
        modelDefault = deviceModelsCache.find(m => m._id === device.model || m.name === device.model);
      }
    }
    const deviceConsumption = Number(device.consumption);
    const modelConsumption = modelDefault ? Number(modelDefault.consumption) : NaN;
    if (
      modelDefault &&
      !isNaN(deviceConsumption) &&
      !isNaN(modelConsumption) &&
      deviceConsumption !== modelConsumption
    ) {
      consumptionClass = 'bg-warning text-dark';
    }
    return `<tr>
      <td>${device.ip || '-'}</td>
      <td class="${statusClass}">${statusText}${device.alert ? ' (Ошибка)' : ''}</td>
      <td>${device.mac || '-'}</td>
      <td>${device.worker || '-'}</td>
      <td class="${consumptionClass}">${device.consumption ? `${device.consumption} Вт` : '-'}</td>
      <td>${lastSeen}</td>
      <td class="text-center align-middle" style="height: 56px;">
        <div class="form-check form-switch d-flex justify-content-center align-items-center" style="height:100%; margin-right:24px;">
          <input class="form-check-input" type="checkbox" style="margin-top:0;width:2.5em;height:1.5em;margin-left:0;margin-right:0;display:block;" ${device.enablePolling ? 'checked' : ''} onchange="toggleDeviceSetting('${device._id}', 'enablePolling', this.checked)">
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
    </tr>`;
  }).join('');
}

function resetAllFilters() {
  document.getElementById('statusFilter').value = 'all';
  document.getElementById('repairFilter').value = 'all';
  document.getElementById('searchInput').value = '';
  applyFilters();
}

// Восстановленная функция для обновления всех данных устройств
async function updateAllStats() {
  await loadDevices();
  applyFilters();
  updateDevicesStatistics();
}
window.updateAllStats = updateAllStats;

function updateTotalConsumption() {
  const total = (devices || []).reduce((sum, d) => sum + (d.consumption || 0), 0);
  const el = document.getElementById('totalConsumption');
  if (el) el.textContent = total + ' Вт';
}

// Взаимное выключение свитчей "Опрос" и "Ремонт"
async function toggleDeviceSetting(deviceId, setting, value) {
  const device = allDevices.find(d => d._id === deviceId);
  if (!device) return;

  // Локально меняем значения
  if (setting === 'inRepair' && value) {
    device.inRepair = true;
    device.enablePolling = false;
  } else if (setting === 'enablePolling' && value) {
    device.enablePolling = true;
    device.inRepair = false;
  } else if (setting === 'inRepair' && !value) {
    device.inRepair = false;
    device.enablePolling = true;
  } else {
    device[setting] = value;
  }

  // Обновляем на сервере
  try {
    const res = await fetch(`/api/devices/${deviceId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inRepair: device.inRepair,
        enablePolling: device.enablePolling
      })
    });
    if (!res.ok) throw new Error('Ошибка обновления устройства');
    const updated = await res.json();
    // Обновляем в массиве
    const idx = allDevices.findIndex(d => d._id === deviceId);
    if (idx !== -1) allDevices[idx] = updated;
    applyFilters();
    updateDevicesStatistics();
  } catch (e) {
    showError('Ошибка обновления устройства');
    // Откатываем локально
    await loadDevices();
  }
}

// Добавляю функцию для сброса формы и состояния при создании нового устройства
function prepareAddDeviceForm() {
  const form = document.getElementById('deviceForm');
  if (form) form.reset();
  selectedDevice = null;
  const saveDeviceBtn = document.getElementById('saveDeviceBtn');
  if (saveDeviceBtn) {
    saveDeviceBtn.dataset.mode = 'add';
    delete saveDeviceBtn.dataset.id;
  }
  // Сбросить select модели
  const deviceModel = document.getElementById('deviceModel');
  if (deviceModel) deviceModel.value = '';
  // Сбросить потребление
  const deviceConsumption = document.getElementById('deviceConsumption');
  if (deviceConsumption) deviceConsumption.value = '';
  // Сбросить все остальные поля
  const deviceIp = document.getElementById('deviceIp');
  if (deviceIp) deviceIp.value = '';
  const deviceMac = document.getElementById('deviceMac');
  if (deviceMac) deviceMac.value = '';
  const deviceSerial = document.getElementById('deviceSerial');
  if (deviceSerial) deviceSerial.value = '';
  const deviceWorker = document.getElementById('deviceWorker');
  if (deviceWorker) deviceWorker.value = '';
  const deviceCards = document.getElementById('deviceCards');
  if (deviceCards) deviceCards.value = '';
  const deviceComment = document.getElementById('deviceComment');
  if (deviceComment) deviceComment.value = '';
  const devicePolling = document.getElementById('devicePolling');
  if (devicePolling) devicePolling.checked = true;
  const deviceRepair = document.getElementById('deviceRepair');
  if (deviceRepair) deviceRepair.checked = false;
  // Меняем заголовок модалки
  const modalTitle = document.getElementById('deviceModalTitle');
  if (modalTitle) modalTitle.textContent = 'Добавить устройство';
}
window.prepareAddDeviceForm = prepareAddDeviceForm;

// Обработчик для кнопки быстрого добавления устройства
const quickAddDeviceBtn = document.getElementById('quickAddDeviceBtn');
if (quickAddDeviceBtn) {
  quickAddDeviceBtn.addEventListener('click', function(e) {
    isEditMode = false;
    prepareAddDeviceForm();
    const modalElement = document.getElementById('deviceModal');
    if (modalElement) {
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
      modalInstance.show();
    }
  });
}
});