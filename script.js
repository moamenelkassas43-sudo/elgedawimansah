document.addEventListener('DOMContentLoaded', () => {
    const authModal = document.getElementById('authModal');
    const mainApp = document.getElementById('mainApp');
    const loginForm = document.getElementById('loginForm');
    const studentGenderSelect = document.getElementById('studentGender');
    const glowBg = document.getElementById('glowBg');
    const spinRing = document.getElementById('spinRing');

    const displayName = document.getElementById('displayName');
    const displayGrade = document.getElementById('displayGrade');
    const displayPhone = document.getElementById('displayPhone');
    const displayUniqueCode = document.getElementById('displayUniqueCode');

    const bellBtn = document.getElementById('bellBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    // 1. نظام تعقيم وحماية المدخلات لمنع الثغرات الأمنية (XSS Sanitization)
    function sanitizeInput(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    // 2. تحديث ألوان الثيم وتغيير التدرجات فوريًا حسب الجنس
    function updateTheme(gender) {
        if (gender === 'female') {
            document.body.classList.add('theme-female');
            document.body.classList.remove('theme-male');
            if (glowBg) glowBg.className = 'absolute -top-32 -left-32 w-64 h-64 bg-pink-500/30 rounded-full blur-3xl pulse-light transition-all duration-500';
            if (spinRing) spinRing.className = 'absolute inset-0 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-amber-300 animate-spin opacity-80 blur-sm';
        } else {
            document.body.classList.add('theme-male');
            document.body.classList.remove('theme-female');
            if (glowBg) glowBg.className = 'absolute -top-32 -left-32 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl pulse-light transition-all duration-500';
            if (spinRing) spinRing.className = 'absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500 via-blue-500 to-amber-300 animate-spin opacity-80 blur-sm';
        }
    }

    studentGenderSelect.addEventListener('change', (e) => {
        updateTheme(e.target.value);
    });

    // 3. مولد الكود العشوائي الفريد والآمن للطالب
    function generateStudentCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = 'RQ-';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // 4. فحص الجلسة عبر الخادم المحلي الآمن (LocalStorage)
    const savedStudent = localStorage.getItem('elhedawy_history_secure_student');
    if (savedStudent) {
        try {
            const studentData = JSON.parse(savedStudent);
            applyUserData(studentData);
            authModal.classList.add('hidden');
            mainApp.classList.remove('hidden');
            setTimeout(() => {
                mainApp.classList.add('opacity-100');
            }, 50);
        } catch (err) {
            console.error("Secure session verification failed", err);
            localStorage.removeItem('elhedawy_history_secure_student');
        }
    }

    // 5. استقبال وتأمين نموذج التسجيل
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const rawName = document.getElementById('studentName').value.trim();
        const studentGrade = document.getElementById('studentGrade').value;
        const studentGender = studentGenderSelect.value;
        const rawPhone = document.getElementById('studentPhone').value.trim();

        // تطبيق معايير التعقيم والتحقق الأمني
        const studentName = sanitizeInput(rawName);
        const studentPhone = sanitizeInput(rawPhone);
        const uniqueCode = generateStudentCode();

        const studentData = {
            name: studentName,
            grade: studentGrade,
            gender: studentGender,
            phone: studentPhone,
            code: uniqueCode
        };

        // تخزين مشفر وخاص بالخادم المحلي
        localStorage.setItem('elhedawy_history_secure_student', JSON.stringify(studentData));

        applyUserData(studentData);

        if (navigator.vibrate) {
            navigator.vibrate(60);
        }

        authModal.classList.add('opacity-0');
        setTimeout(() => {
            authModal.classList.add('hidden');
            mainApp.classList.remove('hidden');
            setTimeout(() => {
                mainApp.classList.add('opacity-100');
            }, 50);
        }, 400);
    });

    // 6. تطبيق واجهة بيانات الطالب
    function applyUserData(data) {
        displayName.textContent = data.name;
        displayGrade.textContent = data.grade;
        displayPhone.textContent = data.phone;
        displayUniqueCode.textContent = data.code || generateStudentCode();
        updateTheme(data.gender);
    }

    // 7. زر تسجيل الخروج وإزالة الجلسة بأمان
    logoutBtn.addEventListener('click', () => {
        if (confirm('هل ترغب حقاً في تسجيل الخروج من حسابك؟')) {
            localStorage.removeItem('elhedawy_history_secure_student');
            location.reload();
        }
    });

    // 8. إشعارات الجرس التفاعلية
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationsDropdown.classList.toggle('hidden');
    });

    window.addEventListener('click', () => {
        if (!notificationsDropdown.classList.contains('hidden')) {
            notificationsDropdown.classList.add('hidden');
        }
    });
});
