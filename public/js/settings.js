// Переменные для настроек
let telegramToken = '';
let telegramChatId = '';
let telegramEnabled = false;
let telegramInitialized = false;
let skipSuccessNotify = false;

document.addEventListener('DOMContentLoaded', function() {
  // === Telegram ===
  const telegramEnabledSwitch = document.getElementById('telegramEnabledSwitch');
  if (telegramEnabledSwitch) {
    telegramEnabledSwitch.addEventListener('change', async function() {
      try {
        skipSuccessNotify = true;
        await saveSettings();
        skipSuccessNotify = false;
      } catch (e) {
        showError('Не удалось изменить статус уведомлений');
      }
    });
  }
  const testTelegramBtn = document.getElementById('testTelegramBtn');
  if (testTelegramBtn) {
    testTelegramBtn.addEventListener('click', testTelegramConnection);
  }
  const telegramEditBtn = document.getElementById('editTelegramBtn');
  if (telegramEditBtn) {
    telegramEditBtn.style.display = 'none';
  }
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.disabled = false;
    saveSettingsBtn.addEventListener('click', saveSettings);
  }
  const editTelegramBtn = document.getElementById('editTelegramBtn');
  const telegramInputs = document.querySelectorAll('#telegramFormFields input');
  // === MAC to IP ===
  const macToIpSwitch = document.getElementById('macToIpSwitch');
  if (macToIpSwitch) {
    macToIpSwitch.addEventListener('change', async function() {
      try {
        await saveMacToIpSetting();
      } catch (e) {
        showError('Не удалось изменить настройку MAC→IP');
      }
    });
  }
  loadSettings();
  loadMacToIpSetting();
});
async function loadSettings() {
  try {
    showLoading('settingsContainer');
    const response = await fetch('/api/settings');
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `Ошибка ${response.status}: ${response.statusText}` }));
      throw new Error(errorData.error || `Ошибка загрузки настроек: ${response.status}`);
    }
    const settings = await response.json();
    telegramToken = settings.telegramToken || '';
    telegramChatId = settings.telegramChatId || '';
    telegramEnabled = settings.telegramEnabled === true;
    telegramInitialized = settings.telegramInitialized === true;
    const tokenInput = document.getElementById('telegramTokenInput');
    const chatIdInput = document.getElementById('telegramChatIdInput');
    const enabledSwitch = document.getElementById('telegramEnabledSwitch');
    if (tokenInput) tokenInput.value = telegramToken;
    if (chatIdInput) chatIdInput.value = telegramChatId;
    if (enabledSwitch) enabledSwitch.checked = telegramEnabled;
    updateTelegramSettingsVisibility();
    updateTelegramInitializationState();
  } catch (error) {
    showError(`Не удалось загрузить настройки: ${error.message}`);
  } finally {
    hideLoading('settingsContainer');
  }
}
function updateTelegramSettingsVisibility() {
  const enabledSwitch = document.getElementById('telegramEnabledSwitch');
  const settingsBlock = document.getElementById('telegramSettingsBlock');
  if (!settingsBlock) return;
  // Форма всегда видна
  settingsBlock.style.display = '';
  // input всегда редактируемые
}
function updateTelegramInitializationState() {
  const fields = document.querySelectorAll('#telegramFormFields input');
  const testBtn = document.getElementById('testTelegramBtn');
  const connectedBtn = document.getElementById('telegramConnectedBtn');
  const editBtn = document.getElementById('editTelegramBtn');
  const saveBtn = document.getElementById('saveSettingsBtn');
  if (!testBtn || !connectedBtn || !editBtn || !saveBtn) return;
  // input всегда редактируемые
  fields.forEach(field => { field.removeAttribute('readonly'); field.disabled = false; });
  testBtn.classList.remove('d-none');
  connectedBtn.classList.add('d-none');
  editBtn.classList.add('d-none');
  saveBtn.classList.remove('d-none');
  testBtn.textContent = 'Проверить подключение';
  testBtn.className = 'btn btn-primary';
  editBtn.disabled = false;
}
async function testTelegramConnection() {
  const tokenInput = document.getElementById('telegramTokenInput');
  const chatIdInput = document.getElementById('telegramChatIdInput');
  const testBtn = document.getElementById('testTelegramBtn');
  if (!tokenInput || !chatIdInput || !testBtn) return;
  const telegramToken = tokenInput.value.trim();
  const telegramChatId = chatIdInput.value.trim();
  if (!telegramToken || !telegramChatId) {
    showWarning('Введите Token и Chat ID');
    return;
  }
  const originalClass = testBtn.className;
  const originalWidth = testBtn.offsetWidth;
  testBtn.style.width = originalWidth + 'px';
  testBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Проверка...';
  testBtn.className = originalClass;
  testBtn.disabled = true;
  try {
    const response = await fetch('/api/settings/test-telegram', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ token: telegramToken, chatId: telegramChatId })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      let seconds = 3;
      testBtn.className = originalClass + ' btn-success';
      const updateText = () => {
        testBtn.textContent = `Успешно! (${seconds})`;
      };
      updateText();
      const timer = setInterval(() => {
        seconds--;
        if (seconds > 0) {
          updateText();
        } else {
          clearInterval(timer);
          testBtn.textContent = 'Протестировать';
          testBtn.className = originalClass;
          testBtn.disabled = false;
          testBtn.style.width = '';
        }
      }, 1000);
    } else {
      let seconds = 3;
      testBtn.className = originalClass + ' btn-danger';
      const updateText = () => {
        testBtn.textContent = `Ошибка (${seconds})`;
      };
      updateText();
      const timer = setInterval(() => {
        seconds--;
        if (seconds > 0) {
          updateText();
        } else {
          clearInterval(timer);
          testBtn.textContent = 'Протестировать';
          testBtn.className = originalClass;
          testBtn.disabled = false;
          testBtn.style.width = '';
        }
      }, 1000);
    }
  } catch (error) {
    let seconds = 3;
    testBtn.className = originalClass + ' btn-danger';
    const updateText = () => {
      testBtn.textContent = `Ошибка (${seconds})`;
    };
    updateText();
    const timer = setInterval(() => {
      seconds--;
      if (seconds > 0) {
        updateText();
      } else {
        clearInterval(timer);
        testBtn.textContent = 'Протестировать';
        testBtn.className = originalClass;
        testBtn.disabled = false;
        testBtn.style.width = '';
      }
    }, 1000);
  }
}
function showLoading(containerId) {
  // Можно реализовать отображение лоадера, если нужно
}
async function saveSettings(showNotify = true) {
  const enabledSwitch = document.getElementById('telegramEnabledSwitch');
  const telegramEnabled = enabledSwitch ? enabledSwitch.checked : false;
  let settings = {
    telegramEnabled: telegramEnabled,
    telegramInitialized: telegramInitialized
  };
  // Всегда сохраняем токен и chatId
  const tokenInput = document.getElementById('telegramTokenInput');
  const chatIdInput = document.getElementById('telegramChatIdInput');
  if (tokenInput) settings.telegramToken = tokenInput.value.trim();
  if (chatIdInput) settings.telegramChatId = chatIdInput.value.trim();
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(settings)
    });
    const data = await response.json();
    if (data.success) {
      telegramToken = settings.telegramToken || telegramToken;
      telegramChatId = settings.telegramChatId || telegramChatId;
      if (showNotify) {
        showSuccess('Настройки успешно сохранены');
      }
    }
  } catch (error) {
    showError('Не удалось сохранить настройки');
  }
}
async function loadMacToIpSetting() {
  const macToIpSwitch = document.getElementById('macToIpSwitch');
  if (!macToIpSwitch) return;
  try {
    const res = await fetch('/api/settings/mac-to-ip');
    const data = await res.json();
    macToIpSwitch.checked = !!data.macToIpEnabled;
  } catch {
    macToIpSwitch.checked = false;
  }
}
async function saveMacToIpSetting() {
  const macToIpSwitch = document.getElementById('macToIpSwitch');
  if (!macToIpSwitch) return;
  await fetch('/api/settings/mac-to-ip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ macToIpEnabled: macToIpSwitch.checked })
  });
} 