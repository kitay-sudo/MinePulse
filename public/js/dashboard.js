document.addEventListener('DOMContentLoaded', () => {
  // Загружаем статистику дашборда
  const statsContainer = document.querySelector('.dashboard-stats');
  if (statsContainer) {
    loadDashboardStats();
  }

  // Загружаем данные для графика
  const chartContainer = document.getElementById('devices-chart');
  if (chartContainer) {
    loadChartData();
  }

  // showMonitoringLastUpdateFromLocalOrSpinner(); // Показываем из localStorage или спиннер
  loadMonitoringLastUpdate(); // Сразу делаем запрос к серверу
  loadMonitoringStatus();
  setInterval(loadMonitoringLastUpdate, 3000); // Обновляем каждые 3 секунды

  // Назначаем обработчик клика ЯВНО после полной загрузки DOM
  setTimeout(() => {
    const btn = document.getElementById('toggleMonitoringBtn');
    if (btn) {
      btn.onclick = function() {
        console.log('Клик по кнопке мониторинга');
        toggleMonitoring();
      };
    } else {
      console.warn('Кнопка мониторинга не найдена!');
    }
  }, 0);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadMonitoringLastUpdate(); // Сразу делаем запрос при возврате на вкладку
  }
});

/**
 * Загружает статистику дашборда
 */
async function loadDashboardStats() {
  const statsContainer = document.querySelector('.dashboard-stats');
  if (!statsContainer) return;

  // Показываем индикаторы загрузки
  const statCards = statsContainer.querySelectorAll('.stat-card');
  statCards.forEach(card => {
    const countElement = card.querySelector('.stat-count');
    if (countElement) {
      countElement.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Загрузка...</span></div>';
    }
  });

  try {
    const stats = await apiRequest('/api/stats/dashboard');
    
    // Обновляем статистику
    const totalDevicesEl = document.getElementById('total-devices');
    const onlineDevicesEl = document.getElementById('online-devices');
    const totalPingsEl = document.getElementById('total-pings');
    const totalReportsEl = document.getElementById('total-reports');
    
    if (totalDevicesEl) totalDevicesEl.textContent = stats.totalDevices || 0;
    if (onlineDevicesEl) onlineDevicesEl.textContent = stats.onlineDevices || 0;
    if (totalPingsEl) totalPingsEl.textContent = stats.totalPings || 0;
    if (totalReportsEl) totalReportsEl.textContent = stats.totalReports || 0;
    
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
    showError('Не удалось загрузить статистику дашборда');
    
    // Показываем ошибку в карточках
    statCards.forEach(card => {
      const countElement = card.querySelector('.stat-count');
      if (countElement) {
        countElement.textContent = 'Н/Д';
      }
    });
  }
}

/**
 * Загружает данные для графика активности устройств
 */
async function loadChartData() {
  const chartContainer = document.getElementById('devices-chart');
  if (!chartContainer) return;
  
  // Показываем индикатор загрузки
  chartContainer.innerHTML = '<div class="d-flex justify-content-center align-items-center" style="height: 300px;"><div class="spinner-border" role="status"><span class="visually-hidden">Загрузка данных графика...</span></div></div>';
  
  try {
    const chartData = await apiRequest('/api/stats/chart');
    renderChart(chartData);
  } catch (error) {
    console.error('Ошибка загрузки данных для графика:', error);
    showError('Не удалось загрузить данные для графика');
    
    // Показываем сообщение об ошибке в контейнере графика
    chartContainer.innerHTML = '<div class="alert alert-danger text-center">Не удалось загрузить данные для графика</div>';
  }
}

/**
 * Отрисовывает график активности устройств
 * @param {Object} data - данные для графика
 */
function renderChart(data) {
  const ctx = document.getElementById('devices-chart').getContext('2d');
  
  // Проверяем, существует ли уже график, и уничтожаем его перед созданием нового
  if (window.deviceActivityChart instanceof Chart) {
    window.deviceActivityChart.destroy();
  }
  
  window.deviceActivityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels || [],
      datasets: [
        {
          label: 'Онлайн устройства',
          data: data.onlineDevices || [],
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        },
        {
          label: 'Все устройства',
          data: data.totalDevices || [],
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          mode: 'index',
          intersect: false
        },
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Активность устройств'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Период'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Количество устройств'
          }
        }
      }
    }
  });
}

function showMonitoringLastUpdateFromLocalOrSpinner() {
  const el = document.getElementById('monitoringLastUpdate');
  if (!el) return;
  const lastUpdate = localStorage.getItem('monitoringLastUpdate');
  if (lastUpdate) {
    el.textContent = lastUpdate;
  } else {
    el.innerHTML = '<span class="spinner-border spinner-border-sm text-secondary me-1" role="status"></span> Ожидаем обновления опроса...';
  }
}

async function loadMonitoringLastUpdate() {
  const el = document.getElementById('monitoringLastUpdate');
  if (!el) return;
  try {
    const res = await fetch('/api/settings/monitoring');
    const data = await res.json();
    console.log('Ответ сервера:', data);
    if (data.monitoringLastUpdate) {
      const dt = new Date(data.monitoringLastUpdate);
      el.textContent = dt.toLocaleString('ru-RU');
    } else {
      el.innerHTML = '<span class="spinner-border spinner-border-sm text-secondary me-1" role="status"></span> Ожидаем опроса...';
    }
  } catch (e) {
    console.error('Ошибка запроса:', e);
    el.innerHTML = '<span class="spinner-border spinner-border-sm text-secondary me-1" role="status"></span> Ожидаем опроса...';
  }
}

async function loadMonitoringStatus() {
  const btn = document.getElementById('toggleMonitoringBtn');
  const icon = document.getElementById('monitoringStatusIcon');
  if (!btn || !icon) return;
  btn.disabled = true;
  try {
    const res = await fetch('/api/settings/monitoring');
    const data = await res.json();
    btn.classList.remove('btn-outline-success', 'btn-outline-danger', 'btn-success', 'btn-danger');
    icon.classList.remove('text-white');
    icon.removeAttribute('style');
    if (data.monitoringEnabled) {
      btn.classList.add('btn-success');
      icon.className = 'bi bi-power';
      btn.title = 'Выключить мониторинг';
    } else {
      btn.classList.add('btn-danger');
      icon.className = 'bi bi-power';
      icon.setAttribute('style', 'color:white');
      btn.title = 'Включить мониторинг';
    }
    btn.disabled = false;
    btn.dataset.enabled = data.monitoringEnabled ? '1' : '0';
  } catch {
    icon.className = 'bi bi-exclamation-triangle';
    btn.title = 'Ошибка';
  }
}

window.toggleMonitoring = async function() {
  console.log('toggleMonitoring вызвана');
  const btn = document.getElementById('toggleMonitoringBtn');
  if (!btn) return;
  const enabled = btn.dataset.enabled === '1';
  btn.disabled = true;
  try {
    const res = await fetch('/api/settings/monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monitoringEnabled: !enabled })
    });
    await res.json();
    await loadMonitoringStatus();
  } catch {
    alert('Ошибка смены статуса мониторинга');
  }
  btn.disabled = false;
} 