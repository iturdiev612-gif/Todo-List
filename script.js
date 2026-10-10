
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_KEY = "taskflow_tasks_v1";
const SETTINGS_KEY = "taskflow_settings_v1";

const PRIORITIES = {
  high: { label: "Высокий", weight: 3 },
  medium: { label: "Средний", weight: 2 },
  low: { label: "Низкий", weight: 1 }
};

const CATEGORY_COLORS = {
  "Работа": "purple",
  "Учёба": "blue",
  "Личное": "green",
  "Другое": "orange"
};

let tasks = loadTasks();
let settings = loadSettings();
let currentFilter = "all";
let currentCategory = null;
let editingId = null;
let toastTimer;

const dialog = $("#taskDialog");
const taskForm = $("#taskForm");
const taskList = $("#taskList");

// ---------- ХРАНЕНИЕ ДАННЫХ ----------

function loadTasks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(data)) return [];

    return data.filter(task =>
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.completed === "boolean"
    ).map(task => ({
      id: task.id,
      title: task.title.slice(0, 120),
      description: typeof task.description === "string"
        ? task.description.slice(0, 1000) : "",
      category: ["Работа", "Учёба", "Личное", "Другое"]
        .includes(task.category) ? task.category : "Другое",
      priority: PRIORITIES[task.priority] ? task.priority : "medium",
      deadline: typeof task.deadline === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(task.deadline) &&
        isValidDate(task.deadline) ? task.deadline : "",
      completed: task.completed,
      createdAt: Number.isFinite(task.createdAt)
        ? task.createdAt : Date.now(),
      completedAt: Number.isFinite(task.completedAt)
        ? task.completedAt : null
    }));
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { theme: saved.theme === "dark" ? "dark" : "light" };
  } catch {
    return { theme: "light" };
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    showToast("Не удалось сохранить данные. Проверь хранилище браузера.");
    return false;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    showToast("Не удалось сохранить настройки.");
  }
}

function isValidDate(value) {
  const date = new Date(value + "T00:00:00");
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function makeId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Локальная дата, без смещения UTC.
function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function isOverdue(task) {
  return !task.completed &&
    Boolean(task.deadline) &&
    task.deadline < localDateString();
}

// ---------- УВЕДОМЛЕНИЯ ----------

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// ---------- ТЕМА ----------

function applyTheme() {
  document.body.classList.toggle("dark", settings.theme === "dark");
  $("#themeIcon").textContent = settings.theme === "dark" ? "☀" : "☾";
  $("#themeToggle").lastChild.textContent =
    settings.theme === "dark" ? " Светлая тема" : " Сменить тему";
}

$("#themeToggle").addEventListener("click", () => {
  settings.theme = settings.theme === "dark" ? "light" : "dark";
  applyTheme();
  saveSettings();
});

// ---------- МОДАЛЬНОЕ ОКНО ----------

function openDialog(task = null) {
  editingId = task ? task.id : null;
  taskForm.reset();

  $("#dialogTitle").textContent = task ? "Редактировать задачу" : "Новая задача";
  $("#saveTaskBtn").textContent = task ? "Сохранить изменения" : "Сохранить задачу";

  $("#taskTitle").value = task?.title || "";
  $("#taskDescription").value = task?.description || "";
  $("#taskCategory").value = task?.category || "Работа";
  $("#taskPriority").value = task?.priority || "medium";
  $("#taskDeadline").value = task?.deadline || "";

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    showToast("Твой браузер не поддерживает диалоговые окна.");
  }

  setTimeout(() => $("#taskTitle").focus(), 50);
}

function closeDialog() {
  dialog.close();
  editingId = null;
}

$("#openAddBtn").addEventListener("click", () => openDialog());
$("#emptyAddBtn").addEventListener("click", () => openDialog());
$("#closeDialogBtn").addEventListener("click", closeDialog);
$("#cancelDialogBtn").addEventListener("click", closeDialog);

dialog.addEventListener("click", event => {
  if (event.target === dialog) closeDialog();
});

taskForm.addEventListener("submit", event => {
  event.preventDefault();

  const title = $("#taskTitle").value.trim();

  if (!title) {
    showToast("Введи название задачи.");
    $("#taskTitle").focus();
    return;
  }

  const deadline = $("#taskDeadline").value;

  if (deadline && !isValidDate(deadline)) {
    showToast("Укажи корректную дату.");
    return;
  }

  const now = Date.now();

  const values = {
    title,
    description: $("#taskDescription").value.trim(),
    category: $("#taskCategory").value,
    priority: $("#taskPriority").value,
    deadline
  };

  if (editingId) {
    const index = tasks.findIndex(task => task.id === editingId);
    if (index === -1) {
      showToast("Задача не найдена.");
      closeDialog();
      return;
    }

    tasks[index] = { ...tasks[index], ...values };
    showToast("Задача успешно обновлена!");
  } else {
    tasks.unshift({
      id: makeId(),
      ...values,
      completed: false,
      createdAt: now,
      completedAt: null
    });
    showToast("Новая задача добавлена!");
  }

  saveTasks();
  closeDialog();
  render();
});

// ---------- ФИЛЬТРЫ И ПОИСК ----------

function getVisibleTasks() {
  const query = $("#searchInput").value.trim().toLocaleLowerCase("ru");
  const priority = $("#priorityFilter").value;
  const sort = $("#sortSelect").value;
  const today = localDateString();

  let result = tasks.filter(task => {
    const matchesSearch =
      task.title.toLocaleLowerCase("ru").includes(query) ||
      task.description.toLocaleLowerCase("ru").includes(query);

    const matchesPriority =
      priority === "all" || task.priority === priority;

    let matchesFilter = true;

    switch (currentFilter) {
      case "today":
        matchesFilter = task.deadline === today && !task.completed;
        break;
      case "active":
        matchesFilter = !task.completed;
        break;
      case "completed":
        matchesFilter = task.completed;
        break;
      case "overdue":
        matchesFilter = isOverdue(task);
        break;
    }

    const matchesCategory =
      !currentCategory || task.category === currentCategory;

    return matchesSearch && matchesPriority &&
      matchesFilter && matchesCategory;
  });

  result.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.createdAt - b.createdAt;
      case "deadline":
        return (a.deadline || "9999-12-31")
          .localeCompare(b.deadline || "9999-12-31");
      case "priority":
        return PRIORITIES[b.priority].weight -
          PRIORITIES[a.priority].weight;
      case "alphabetical":
        return a.title.localeCompare(b.title, "ru");
      case "newest":
      default:
        return b.createdAt - a.createdAt;
    }
  });

  return result;
}

function updateFilterUI() {
  $$(".nav-link[data-filter]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.filter === currentFilter && !currentCategory
    );
  });

  $$(".category-link").forEach(button => {
    const active = button.dataset.category === currentCategory;
    button.style.background = active ? "#7865f529" : "";
    button.style.color = active ? "#b9adff" : "";
  });

  const titles = {
    all: "Мои задачи",
    today: "На сегодня",
    active: "В процессе",
    completed: "Выполненные задачи",
    overdue: "Просроченные задачи"
  };

  $("#pageTitle").textContent =
    currentCategory || titles[currentFilter] || "Мои задачи";

  $("#listTitle").textContent =
    currentCategory ? `Категория: ${currentCategory}` :
    currentFilter === "all" ? "Список задач" :
    titles[currentFilter];

  $("#listSubtitle").textContent = currentCategory
    ? "Задачи выбранной категории"
    : "Управляй своим временем эффективно";
}

$$(".nav-link[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    currentCategory = null;
    updateFilterUI();
    render();
  });
});

$$(".category-link").forEach(button => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;
    currentCategory = currentCategory === category ? null : category;
    currentFilter = "all";
    updateFilterUI();
    render();
  });
});

$("#searchInput").addEventListener("input", render);
$("#priorityFilter").addEventListener("change", render);
$("#sortSelect").addEventListener("change", render);

// ---------- СОЗДАНИЕ ЭЛЕМЕНТОВ ----------

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createButton(label, title, className, action) {
  const button = createElement("button", className, label);
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("click", action);
  return button;
}

function renderTask(task) {
  const item = createElement(
    "article",
    `task-item${task.completed ? " is-completed" : ""}`
  );

  const checkbox = createElement("input", "task-check");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `Выполнить: ${task.title}`);

  checkbox.addEventListener("change", () => {
    task.completed = checkbox.checked;
    task.completedAt = task.completed ? Date.now() : null;
    saveTasks();
    render();
    showToast(task.completed ? "Задача выполнена! 🎉" : "Задача возвращена в работу.");
  });

  const content = createElement("div", "task-content");
  content.append(createElement("h3", "task-title", task.title));

  if (task.description) {
    content.append(createElement("p", "task-description", task.description));
  }

  const meta = createElement("div", "task-meta");

  const category = createElement("span", "tag category");
  const dot = createElement(
    "span",
    `category-dot ${CATEGORY_COLORS[task.category] || "orange"}`
  );
  dot.style.marginRight = "6px";
  category.append(dot, document.createTextNode(task.category));
  meta.append(category);

  const priorityInfo = PRIORITIES[task.priority] || PRIORITIES.medium;
  meta.append(createElement(
    "span",
    `tag priority-${task.priority}`,
    priorityInfo.label + " приоритет"
  ));

  if (task.deadline) {
    let deadlineText = "Срок: " + formatDate(task.deadline);

    if (isOverdue(task)) deadlineText += " · просрочено";
    else if (!task.completed && task.deadline === localDateString()) {
      deadlineText += " · сегодня";
    }

    meta.append(createElement(
      "span",
      `deadline${isOverdue(task) ? " late" : ""}`,
      deadlineText
    ));
  }

  content.append(meta);

  const actions = createElement("div", "task-actions");

  actions.append(createButton(
    "✎", "Редактировать", "task-action",
    () => openDialog(task)
  ));

  actions.append(createButton(
    "↗", task.completed ? "Вернуть в работу" : "Отметить выполненной",
    "task-action",
    () => {
      task.completed = !task.completed;
      task.completedAt = task.completed ? Date.now() : null;
      saveTasks();
      render();
      showToast(task.completed ? "Задача выполнена!" : "Задача возвращена в работу.");
    }
  ));

  actions.append(createButton(
    "×", "Удалить задачу", "task-action delete",
    () => deleteTask(task.id)
  ));

  item.append(checkbox, content, actions);
  return item;
}

// ---------- УДАЛЕНИЕ ----------

function deleteTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  if (!confirm(`Удалить задачу «${task.title}»?`)) return;

  tasks = tasks.filter(item => item.id !== id);
  saveTasks();
  render();
  showToast("Задача удалена.");
}

$("#clearCompletedBtn").addEventListener("click", () => {
  const count = tasks.filter(task => task.completed).length;

  if (!count) {
    showToast("Нет выполненных задач для очистки.");
    return;
  }

  if (!confirm(`Удалить все выполненные задачи (${count})?`)) return;

  tasks = tasks.filter(task => !task.completed);
  saveTasks();
  render();
  showToast("Выполненные задачи очищены.");
});

// ---------- СТАТИСТИКА ----------

function renderStats() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const active = total - completed;
  const overdue = tasks.filter(isOverdue).length;
  const percent = total ? Math.round(completed / total * 100) : 0;

  $("#totalStat").textContent = total;
  $("#activeStat").textContent = active;
  $("#completedStat").textContent = completed;
  $("#overdueStat").textContent = overdue;
  $("#allCount").textContent = total;

  $("#overallPercent").textContent = percent + "%";
  $("#overallProgress").style.width = percent + "%";
  $("#sidePercent").textContent = percent + "%";
  $("#sideProgress").style.width = percent + "%";

  $("#sideProgressText").textContent = total
    ? `Выполнено ${completed} из ${total} задач`
    : "Начни выполнять задачи!";

  $("#progressMessage").textContent = !total
    ? "Добавь первую задачу и начни свой путь!"
    : percent === 100
      ? "Великолепно! Все задачи выполнены 🎉"
      : `Ты выполнил ${completed} из ${total} задач. Продолжай!`;

  $("#currentDate").textContent = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date()).toLocaleUpperCase("ru");
}

// ---------- ОТРИСОВКА ----------

function render() {
  updateFilterUI();
  renderStats();

  const visibleTasks = getVisibleTasks();
  taskList.replaceChildren();

  visibleTasks.forEach(task => taskList.append(renderTask(task)));

  $("#emptyState").classList.toggle("visible", visibleTasks.length === 0);

  const hasTasks = tasks.length > 0;
  $("#emptyState h3").textContent = hasTasks
    ? "Ничего не найдено"
    : "Здесь пока пусто";

  $("#emptyState p").textContent = hasTasks
    ? "Попробуй изменить поиск или фильтры."
    : "Добавь свою первую задачу и начни действовать!";

  $("#emptyAddBtn").style.display = hasTasks ? "none" : "";

  $("#footerCount").textContent =
    `Показано ${visibleTasks.length} из ${tasks.length} задач`;
}

// ---------- ЭКСПОРТ ----------

$("#exportBtn").addEventListener("click", () => {
  if (!tasks.length) {
    showToast("Сначала добавь хотя бы одну задачу.");
    return;
  }

  const data = {
    application: "TaskFlow",
    exportedAt: new Date().toISOString(),
    tasks
  };

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `taskflow-backup-${localDateString()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Резервная копия скачана.");
});

// ---------- ЗАПУСК ----------

applyTheme();
render();