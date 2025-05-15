// Переменные для отчетов
let reports = [];
let reportDevices = [];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  // Загружаем отчеты при наличии таблицы отчетов
  const reportsTable = document.getElementById('reports-table');
  if (reportsTable) {
    loadReports();
    loadDevices();
  }

  // Инициализируем форму создания отчета
  const reportForm = document.getElementById('report-form');
  if (reportForm) {
    reportForm.addEventListener('submit', handleReportFormSubmit);
  }

  // Инициализируем обработчик изменения периода отчета
  const reportPeriod = document.getElementById('report-period');
  if (reportPeriod) {
    reportPeriod.addEventListener('change', handleReportPeriodChange);
  }
});

/**
 * Загрузка списка отчетов
 */
async function loadReports() {
  const reportsTableBody = document.querySelector('#reports-table tbody');
  if (!reportsTableBody) return;

  // Показываем индикатор загрузки
  reportsTableBody.innerHTML = `
    <tr>
      <td colspan="5" class="text-center">
        <div class="spinner-border spinner-border-sm" role="status">
          <span class="visually-hidden">Загрузка отчетов...</span>
        </div>
        <span class="ms-2">Загрузка отчетов...</span>
      </td>
    </tr>
  `;

  try {
    reports = await apiRequest('/api/reports');
    
    // Сортируем отчеты по дате создания (самые новые сверху)
    reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    renderReportsTable();
  } catch (error) {
    console.error('Ошибка загрузки отчетов:', error);
    showError('Не удалось загрузить отчеты');
    reportsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-danger">
          Не удалось загрузить отчеты. Попробуйте обновить страницу.
        </td>
      </tr>
    `;
  }
}

/**
 * Отрисовка таблицы отчетов
 */
function renderReportsTable() {
  const reportsTableBody = document.querySelector('#reports-table tbody');
  if (!reportsTableBody) return;

  if (reports.length === 0) {
    reportsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">
          Отчеты отсутствуют. Создайте новый отчет.
        </td>
      </tr>
    `;
    return;
  }

  reportsTableBody.innerHTML = reports.map(report => `
    <tr>
      <td>${report.name || 'Без названия'}</td>
      <td>${report.deviceName || 'Все устройства'}</td>
      <td>${formatDate(report.startDate)} - ${formatDate(report.endDate)}</td>
      <td>${formatDate(report.createdAt, true)}</td>
      <td>
        <div class="btn-group btn-group-sm">
          <a href="/reports/${report.id}" class="btn btn-primary" target="_blank">
            <i class="bi bi-eye"></i>
          </a>
          <button class="btn btn-danger delete-report" data-report-id="${report.id}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Обработчики для кнопок удаления
  document.querySelectorAll('.delete-report').forEach(button => {
    button.addEventListener('click', async (e) => {
      const reportId = e.currentTarget.dataset.reportId;
      if (confirm('Вы уверены, что хотите удалить отчет?')) {
        await deleteReport(reportId);
      }
    });
  });
}

/**
 * Загрузка списка устройств для фильтра
 */
async function loadDevices() {
  const deviceSelect = document.getElementById('report-device');
  if (!deviceSelect) return;

  try {
    reportDevices = await apiRequest('/api/devices');
    
    // Добавляем опцию "Все устройства"
    deviceSelect.innerHTML = `<option value="">Все устройства</option>`;
    
    // Добавляем устройства в выпадающий список
    reportDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = device.name;
      deviceSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Ошибка загрузки устройств:', error);
    showError('Не удалось загрузить список устройств');
    deviceSelect.innerHTML = `<option value="">Не удалось загрузить устройства</option>`;
  }
}

/**
 * Обработка отправки формы создания отчета
 */
async function handleReportFormSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  
  // Показываем индикатор загрузки
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Создание отчета...`;
  
  try {
    const formData = new FormData(form);
    const reportData = {
      name: formData.get('name'),
      deviceId: formData.get('deviceId') || null,
      period: formData.get('period'),
      startDate: formData.get('startDate') || null,
      endDate: formData.get('endDate') || null
    };
    
    // Валидация дат для кастомного периода
    if (reportData.period === 'custom') {
      if (!reportData.startDate || !reportData.endDate) {
        throw new Error('Для кастомного периода необходимо указать начальную и конечную даты');
      }
      
      const startDate = new Date(reportData.startDate);
      const endDate = new Date(reportData.endDate);
      
      if (startDate > endDate) {
        throw new Error('Дата начала не может быть позже даты окончания');
      }
    }
    
    const result = await apiRequest('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportData)
    });
    
    showSuccess('Отчет успешно создан');
    
    // Добавляем новый отчет в список и обновляем таблицу
    reports.unshift(result);
    renderReportsTable();
    
    // Сбрасываем форму
    form.reset();
    
    // Если есть кастомные поля дат, скрываем их
    const dateRangeFields = document.getElementById('date-range-fields');
    if (dateRangeFields) {
      dateRangeFields.classList.add('d-none');
    }
  } catch (error) {
    console.error('Ошибка создания отчета:', error);
    showError(error.message || 'Не удалось создать отчет');
  } finally {
    // Восстанавливаем кнопку
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}

/**
 * Обработка изменения периода отчета
 */
function handleReportPeriodChange(event) {
  const period = event.target.value;
  const dateRangeFields = document.getElementById('date-range-fields');
  
  if (period === 'custom' && dateRangeFields) {
    dateRangeFields.classList.remove('d-none');
  } else if (dateRangeFields) {
    dateRangeFields.classList.add('d-none');
  }
}

/**
 * Удаление отчета
 */
async function deleteReport(reportId) {
  try {
    const btn = document.querySelector(`.delete-report[data-report-id="${reportId}"]`);
    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;
    }
    
    await apiRequest(`/api/reports/${reportId}`, {
      method: 'DELETE'
    });
    
    // Удаляем отчет из массива и обновляем таблицу
    reports = reports.filter(report => report.id !== reportId);
    renderReportsTable();
    
    showSuccess('Отчет успешно удален');
  } catch (error) {
    console.error('Ошибка удаления отчета:', error);
    showError('Не удалось удалить отчет');
    
    // Восстанавливаем кнопку
    const btn = document.querySelector(`.delete-report[data-report-id="${reportId}"]`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-trash"></i>`;
    }
  }
} 