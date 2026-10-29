"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const KEYS = {
    user: "roqi_user",
    tasks: "roqi_tasks",
    notes: "roqi_notes",
    study: "roqi_study",
    theme: "roqi_theme"
};

function loadData(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
    } catch (error) {
        console.error("تعذر قراءة البيانات:", error);
        return fallback;
    }
}

function saveData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error("تعذر حفظ البيانات:", error);
        showToast("تعذر الحفظ. قد تكون مساحة التخزين ممتلئة.", "error");
        return false;
    }
}

let user = loadData(KEYS.user, null);
let tasks = loadData(KEYS.tasks, []);
let notes = loadData(KEYS.notes, []);
let studyPlan = loadData(KEYS.study, []);
let activeFilter = "all";

if (!Array.isArray(tasks)) tasks = [];
if (!Array.isArray(notes)) notes = [];
if (!Array.isArray(studyPlan)) studyPlan = [];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showToast(message, type = "success") {
    const container = $("#toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "error" : ""}`;

    const icon = type === "error"
        ? "fa-circle-exclamation"
        : "fa-circle-check";

    const iconElement = document.createElement("i");
    iconElement.className = `fa-solid ${icon}`;

    const textElement = document.createElement("span");
    textElement.textContent = message;

    toast.append(iconElement, textElement);
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(8px)";
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(dateValue) {
    if (!dateValue) return "دون موعد محدد";

    const date = new Date(`${dateValue}T12:00:00`);

    if (Number.isNaN(date.getTime())) return "دون موعد محدد";

    return new Intl.DateTimeFormat("ar-EG", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

function todayString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function priorityLabel(priority) {
    return {
        urgent: "عاجلة",
        high: "مهمة",
        normal: "عادية"
    }[priority] || "عادية";
}

function priorityClass(priority) {
    return ["urgent", "high"].includes(priority) ? priority : "normal";
}

function showWelcomeModal() {
    const modal = $("#welcomeModal");
    if (!modal) return;

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    setTimeout(() => $("#studentName")?.focus(), 100);
}

function hideWelcomeModal() {
    const modal = $("#welcomeModal");
    if (!modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
}

function updateUserInterface() {
    const name = user?.name || "قائد المستقبل";
    const grade = user?.grade || "المرحلة الثانوية";

    $("#welcomeName").textContent = name;
    $("#homeGrade").textContent = grade;
    $("#profileInitial").textContent = name.trim().charAt(0) || "ط";
    document.title = `منصة تاريخ الرقي | ${name}`;
}

function initDate() {
    const now = new Date();

    const dateText = new Intl.DateTimeFormat("ar-EG", {
        weekday: "long",
        day: "numeric",
        month: "long"
    }).format(now);

    $("#currentDate").textContent = dateText;
    $("#studyDate").textContent = formatDate(todayString());
    $("#footerYear").textContent = now.getFullYear();
}

function applyTheme(theme, persist = true) {
    const light = theme === "light";

    document.body.classList.toggle("light-mode", light);

    const icon = $("#themeIcon");
    if (icon) {
        icon.className = light
            ? "fa-solid fa-sun"
            : "fa-solid fa-moon";
    }

    const metaTheme = $('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute(
            "content",
            light ? "#f3f5f9" : "#0b1020"
        );
    }

    if (persist) {
        try {
            localStorage.setItem(KEYS.theme, theme);
        } catch (error) {
            console.error(error);
        }
    }
}

function navigateTo(sectionId, updateHash = true) {
    const section = document.getElementById(sectionId);
    if (!section || !section.classList.contains("page-section")) return;

    $$(".page-section").forEach(item => {
        item.classList.toggle("active", item.id === sectionId);
    });

    $$(".nav-link").forEach(link => {
        const active = link.dataset.section === sectionId;
        link.classList.toggle("active", active);

        if (active) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    const activeLink = $(`.nav-link[data-section="${sectionId}"]`);
    $("#currentPage").textContent = activeLink
        ? activeLink.textContent.trim()
        : "الرئيسية";

    closeSidebar();

    if (updateHash) {
        history.replaceState(null, "", `#${sectionId}`);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (sectionId === "tasks") renderTasks();
    if (sectionId === "notes") renderNotes();
    if (sectionId === "study") renderStudyPlan();
}

function openSidebar() {
    $("#sidebar")?.classList.add("open");
    $("#sidebarOverlay")?.classList.add("show");
    document.body.style.overflow = "hidden";
}

function closeSidebar() {
    $("#sidebar")?.classList.remove("open");
    $("#sidebarOverlay")?.classList.remove("show");
    document.body.style.overflow = "";
}

function initNavigation() {
    $$(".nav-link").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            navigateTo(link.dataset.section);
        });
    });

    $$("[data-goto]").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            navigateTo(link.dataset.goto);
        });
    });

    $("#menuBtn").addEventListener("click", openSidebar);
    $("#closeSidebar").addEventListener("click", closeSidebar);
    $("#sidebarOverlay").addEventListener("click", closeSidebar);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeSidebar();
            hideWelcomeModal();
        }
    });

    const hash = location.hash.replace("#", "");
    const allowedSections = ["home", "about", "study", "tasks", "notes", "help"];

    if (allowedSections.includes(hash)) {
        navigateTo(hash, false);
    }
}

function renderEmpty(container, icon, title, description, action = "") {
    container.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid ${icon}"></i>
            <h4>${escapeHTML(title)}</h4>
            <p>${escapeHTML(description)}</p>
            ${action}
        </div>
    `;
}

function updateDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const pending = total - completed;
    const rate = total ? Math.round(completed / total * 100) : 0;

    $("#totalTasks").textContent = total;
    $("#completedTasks").textContent = completed;
    $("#completionRate").textContent = `${rate}%`;
    $("#ringPercentage").textContent = `${rate}%`;

    $("#progressRing").style.setProperty("--progress", `${rate}%`);

    $("#taskSummaryTotal").textContent = total;
    $("#taskSummaryPending").textContent = pending;
    $("#taskSummaryCompleted").textContent = completed;

    $("#progressTitle").textContent =
        total === 0 ? "بداية موفقة!" :
        rate === 100 ? "إنجاز رائع!" :
        rate >= 50 ? "أنت على الطريق الصحيح!" :
        "كل خطوة بتفرق!";

    $("#progressMessage").textContent =
        total === 0
            ? "أضف أول مهمة دراسية لتبدأ متابعة تقدمك."
            : rate === 100
                ? "أكملت كل مهامك الحالية. استمر في التميز!"
                : `أنجزت ${completed} من أصل ${total} مهام، والمتبقي ${pending}.`;

    renderLatestTasks();
}

function renderLatestTasks() {
    const container = $("#latestTasks");

    if (!tasks.length) {
        renderEmpty(
            container,
            "fa-clipboard-list",
            "لا توجد مهام حتى الآن",
            "أضف مهامك الدراسية لتظهر هنا.",
            '<a href="#tasks" class="primary-btn small-btn" data-goto="tasks">إضافة أول مهمة</a>'
        );

        const action = $('[data-goto="tasks"]', container);
        if (action) {
            action.addEventListener("click", event => {
                event.preventDefault();
                navigateTo("tasks");
            });
        }
        return;
    }

    const latest = [...tasks]
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        .slice(0, 4);

    container.innerHTML = latest.map(task => `
        <div class="task-item ${task.completed ? "done" : ""}">
            <input
                type="checkbox"
                class="item-check"
                data-task-toggle="${escapeHTML(task.id)}"
                ${task.completed ? "checked" : ""}
                aria-label="تغيير حالة المهمة"
            >
            <div class="item-main">
                <h4>${escapeHTML(task.title)}</h4>
                <p>${escapeHTML(task.subject || "مهمة دراسية")} · ${escapeHTML(formatDate(task.date))}</p>
            </div>
            <span class="priority-tag ${priorityClass(task.priority)}">${priorityLabel(task.priority)}</span>
        </div>
    `).join("");
}

function renderTasks() {
    const container = $("#tasksList");
    const filtered = tasks.filter(task => {
        if (activeFilter === "completed") return task.completed;
        if (activeFilter === "pending") return !task.completed;
        return true;
    });

    if (!filtered.length) {
        renderEmpty(
            container,
            "fa-clipboard-check",
            activeFilter === "completed"
                ? "لا توجد مهام مكتملة"
                : activeFilter === "pending"
                    ? "أحسنت! لا توجد مهام معلّقة"
                    : "قائمة المهام فارغة",
            "أضف مهمة جديدة وابدأ تنظيم يومك."
        );
        updateDashboard();
        return;
    }

    container.innerHTML = filtered
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        .map(task => `
            <article class="task-item ${task.completed ? "done" : ""}">
                <input
                    type="checkbox"
                    class="item-check"
                    data-task-toggle="${escapeHTML(task.id)}"
                    ${task.completed ? "checked" : ""}
                    aria-label="إنجاز المهمة"
                >
                <div class="item-main">
                    <h4>${escapeHTML(task.title)}</h4>
                    <p>${escapeHTML(task.subject || "مهمة دراسية")} · ${escapeHTML(formatDate(task.date))}</p>
                    <div class="item-meta">
                        <span class="priority-tag ${priorityClass(task.priority)}">${priorityLabel(task.priority)}</span>
                        <span class="category-tag">${task.completed ? "مكتملة" : "قيد التنفيذ"}</span>
                    </div>
                </div>
                <button class="item-delete" type="button" data-task-delete="${escapeHTML(task.id)}" aria-label="حذف المهمة">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </article>
        `).join("");

    updateDashboard();
}

function addTask(event) {
    event.preventDefault();

    const title = $("#taskTitle").value.trim();
    if (!title) {
        showToast("اكتب عنوان المهمة أولًا.", "error");
        return;
    }

    const task = {
        id: makeId(),
        title,
        subject: $("#taskSubject").value.trim(),
        date: $("#taskDate").value,
        priority: $("#taskPriority").value,
        completed: false,
        createdAt: Date.now()
    };

    tasks.unshift(task);

    if (!saveData(KEYS.tasks, tasks)) {
        tasks.shift();
        return;
    }

    $("#taskForm").reset();
    $("#taskDate").value = "";
    $("#taskPriority").value = "normal";

    renderTasks();
    updateDashboard();
    showToast("تمت إضافة المهمة بنجاح.");
}

function toggleTask(id) {
    const task = tasks.find(item => String(item.id) === String(id));
    if (!task) return;

    task.completed = !task.completed;

    saveData(KEYS.tasks, tasks);
    renderTasks();
    updateDashboard();

    showToast(task.completed ? "أحسنت! تم إنجاز المهمة." : "تمت إعادة المهمة لقائمة التنفيذ.");
}

function deleteTask(id) {
    const task = tasks.find(item => String(item.id) === String(id));
    if (!task) return;

    if (!confirm(`هل تريد حذف المهمة "${task.title}"؟`)) return;

    tasks = tasks.filter(item => String(item.id) !== String(id));
    saveData(KEYS.tasks, tasks);
    renderTasks();
    updateDashboard();
    showToast("تم حذف المهمة.");
}

function initTasks() {
    $("#taskForm").addEventListener("submit", addTask);

    $("#taskFilters").addEventListener("click", event => {
        const button = event.target.closest("[data-filter]");
        if (!button) return;

        activeFilter = button.dataset.filter;

        $$(".filter-btn").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        renderTasks();
    });

    $("#tasksList").addEventListener("click", event => {
        const deleteButton = event.target.closest("[data-task-delete]");
        if (deleteButton) deleteTask(deleteButton.dataset.taskDelete);
    });

    $("#tasksList").addEventListener("change", event => {
        const checkbox = event.target.closest("[data-task-toggle]");
        if (checkbox) toggleTask(checkbox.dataset.taskToggle);
    });

    $("#latestTasks").addEventListener("change", event => {
        const checkbox = event.target.closest("[data-task-toggle]");
        if (checkbox) toggleTask(checkbox.dataset.taskToggle);
    });

    $("#clearCompleted").addEventListener("click", () => {
        const completed = tasks.filter(task => task.completed);

        if (!completed.length) {
            showToast("لا توجد مهام مكتملة لحذفها.", "error");
            return;
        }

        if (!confirm(`هل تريد حذف ${completed.length} مهمة مكتملة؟`)) return;

        tasks = tasks.filter(task => !task.completed);
        saveData(KEYS.tasks, tasks);
        renderTasks();
        updateDashboard();
        showToast("تم حذف المهام المكتملة.");
    });
}

function renderStudyPlan() {
    const container = $("#studyPlanList");
    $("#studyCount").textContent = `${studyPlan.length} عناصر`;

    if (!studyPlan.length) {
        renderEmpty(
            container,
            "fa-calendar-days",
            "لم تضف جلسات مذاكرة بعد",
            "أضف أول جلسة لتبدأ تنظيم وقتك."
        );
        return;
    }

    const ordered = [...studyPlan].sort((a, b) => {
        return String(a.time).localeCompare(String(b.time));
    });

    container.innerHTML = ordered.map(item => `
        <article class="study-item ${item.completed ? "done" : ""}">
            <input
                type="checkbox"
                class="item-check"
                data-study-toggle="${escapeHTML(item.id)}"
                ${item.completed ? "checked" : ""}
                aria-label="إتمام جلسة المذاكرة"
            >
            <div class="item-main">
                <h4>${escapeHTML(item.subject)}</h4>
                <p><i class="fa-regular fa-clock"></i> ${escapeHTML(item.time)} · ${escapeHTML(String(item.duration))} دقيقة</p>
                <div class="item-meta">
                    <span class="priority-tag ${priorityClass(item.priority)}">${priorityLabel(item.priority)}</span>
                </div>
            </div>
            <button class="item-delete" type="button" data-study-delete="${escapeHTML(item.id)}" aria-label="حذف جلسة المذاكرة">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </article>
    `).join("");
}

function initStudyPlan() {
    $("#studyForm").addEventListener("submit", event => {
        event.preventDefault();

        const subject = $("#studySubject").value.trim();
        const time = $("#studyTime").value;
        const duration = Number($("#studyDuration").value);

        if (!subject || !time || duration < 5 || duration > 600) {
            showToast("راجع بيانات جلسة المذاكرة.", "error");
            return;
        }

        const item = {
            id: makeId(),
            subject,
            time,
            duration,
            priority: $("#studyPriority").value,
            completed: false,
            createdAt: Date.now()
        };

        studyPlan.push(item);

        if (!saveData(KEYS.study, studyPlan)) {
            studyPlan.pop();
            return;
        }

        $("#studyForm").reset();
        $("#studyDuration").value = 45;
        $("#studyPriority").value = "normal";

        renderStudyPlan();
        showToast("تمت إضافة جلسة المذاكرة.");
    });

    $("#studyPlanList").addEventListener("change", event =>
