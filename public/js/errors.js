// Переменные для работы с ошибками
let errors = [];
let lastErrorId = 0;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  // Загружаем ошибки при наличии таблицы ошибок
  const errorsTable = document.getElementById('errorsTable');
  if (errorsTable) {
    loadErrors();
  }

  // Инициализируем кнопку очистки ошибок
  const clearErrorsBtn = document.getElementById('clearErrorsBtn');
  if (clearErrorsBtn) {
    clearErrorsBtn.addEventListener('click', clearAllErrors);
  }
});

// Загрузка ошибок
async function loadErrors() {
  try {
    const loadingIndicator = document.getElementById('errorsLoadingIndicator');
    if (loadingIndicator) loadingIndicator.classList.remove('d-none');
    
    errors = await fetchErrors();
    renderErrorsTable();
    updateErrorBadge();
    
  } catch (error) {
    console.error('Ошибка загрузки ошибок:', error);
    showError('Не удалось загрузить список ошибок');
  } finally {
    const loadingIndicator = document.getElementById('errorsLoadingIndicator');
    if (loadingIndicator) loadingIndicator.classList.add('d-none');
  }
}

// Отображение таблицы ошибок
function renderErrorsTable() {
  const tbody = document.querySelector('#errorsTable tbody');
  if (!tbody) return;
  const noErrorsMessage = document.getElementById('noErrorsMessage');
  if (!errors || errors.length === 0) {
    tbody.innerHTML = '';
    if (noErrorsMessage) noErrorsMessage.classList.remove('d-none');
    return;
  }
  if (noErrorsMessage) noErrorsMessage.classList.add('d-none');
  const sortedErrors = [...errors].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  tbody.innerHTML = sortedErrors.map(error => {
    const timestamp = error.timestamp ? new Date(error.timestamp).toLocaleString('ru-RU') : '-';
    const id = error._id || error.id || '';
    return `<tr>
      <td>${timestamp}</td>
      <td>${error.ip || '-'}</td>
      <td>${error.worker || '-'}</td>
      <td>${error.error || '-'}</td>
      <td class="text-center">${id ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteErrorById('${id}')"><i class="bi bi-trash"></i></button>` : ''}</td>
    </tr>`;
  }).join('');
  const info = document.getElementById('errorsPaginationInfo');
  if (!info) return;
  const start = 0;
  const end = sortedErrors.length;
  info.textContent = `Показано ${end ? start+1 : 0}-${end} из ${end} ошибок`;
}

// Получение класса для типа ошибки
function getErrorTypeClass(type) {
  switch (type.toLowerCase()) {
    case 'critical':
      return 'bg-danger';
    case 'error':
      return 'bg-danger';
    case 'warning':
      return 'bg-warning text-dark';
    case 'info':
      return 'bg-info text-dark';
    default:
      return 'bg-secondary';
  }
}

// Обновление индикатора ошибок в меню
function updateErrorBadge() {
  const errorsBadge = document.getElementById('errorsBadge');
  if (!errorsBadge) return;
  const errorCount = errors ? errors.length : 0;
  if (errorCount > 0) {
    errorsBadge.textContent = errorCount;
    errorsBadge.classList.remove('d-none');
  } else {
    errorsBadge.classList.add('d-none');
  }
}

// Удаление ошибки
async function deleteError(errorId) {
  try {
    await removeError(errorId);
    errors = errors.filter(error => error.id !== errorId);
    renderErrorsTable();
    updateErrorBadge();
    showSuccess('Ошибка удалена');
  } catch (error) {
    console.error('Ошибка при удалении:', error);
    showError('Не удалось удалить ошибку');
  }
}

// Очистка всех ошибок
async function clearAllErrors() {
  if (!confirm('Вы уверены, что хотите удалить все ошибки?')) {
    return;
  }
  
  try {
    await clearErrors();
    errors = [];
    renderErrorsTable();
    updateErrorBadge();
    showSuccess('Все ошибки удалены');
  } catch (error) {
    console.error('Ошибка при очистке ошибок:', error);
    showError('Не удалось очистить ошибки');
  }
}

// Отображение ошибки на странице
function showError(message, autoHide = true) {
  showError(message, autoHide);
}

// Отображение предупреждения на странице
function showWarning(message, autoHide = true) {
  showWarning(message, autoHide);
}

// Отображение успешного сообщения на странице
function showSuccess(message, autoHide = true) {
  showSuccess(message, autoHide);
}

// Отображение информационного сообщения на странице
function showInfo(message, autoHide = true) {
  showInfo(message, autoHide);
}

// Логирование ошибки на сервере
async function logClientError(message, type = 'error') {
  try {
    const error = {
      message,
      type,
      source: 'Клиент',
      timestamp: new Date().toISOString()
    };
    
    await logError(error);
    
    // Обновляем список ошибок, если находимся на странице ошибок
    const errorsTable = document.getElementById('errorsTable');
    if (errorsTable) {
      await loadErrors();
    } else {
      // Иначе просто увеличиваем счетчик
      updateErrorBadge();
    }
  } catch (err) {
    console.error('Ошибка при логировании:', err);
  }
}

// API функции для работы с ошибками
async function fetchErrors() {
  const response = await fetch('/api/errors');
  if (!response.ok) {
    throw new Error('Ошибка загрузки данных');
  }
  return response.json();
}

async function removeError(errorId) {
  const response = await fetch(`/api/errors/${errorId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    throw new Error('Ошибка при удалении');
  }
  
  return response.json();
}

async function clearErrors() {
  const response = await fetch('/api/errors', {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    throw new Error('Ошибка при очистке');
  }
  
  return response.json();
}

async function logError(error) {
  const response = await fetch('/api/errors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(error)
  });
  
  if (!response.ok) {
    throw new Error('Ошибка при логировании');
  }
  
  return response.json();
}

async function deleteErrorById(id) {
  if (!confirm('Удалить эту ошибку?')) return;
  await removeError(id);
  await loadErrors();
}

function goToErrorsPage(page) {
  // Здесь должна быть логика смены страницы пагинации, если она реализована
  // Например: currentPage = page; renderErrorsTable();
  // Если пагинация не реализована — можно оставить пустым или реализовать позже
}

async function deleteAllErrors() {
  if (!confirm('Удалить все ошибки?')) return;
  await clearErrors();
  await loadErrors();
} 