(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const API_BASE = ''; // الواجهة والخادم يعملان من نفس العنوان عند تشغيل server.js.
  const API_ENABLED = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  const authScreen = $('#authScreen');
  const appScreen = $('#appScreen');
  const authForm = $('#authForm');
  const authMessage = $('#authMessage');
  const nameField = $('#nameField');
  const extraFields = $('#extraFields');
  const loginTab = $('#loginTab');
  const registerTab = $('#registerTab');
  const submitBtn = $('#submitBtn');
  const submitText = $('#submitText');
  const passwordInput = $('#studentPassword');
  const toast = $('#toast');

  let authMode = 'login';
  let toastTimer;

  function setTheme(theme) {
    const safeTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = safeTheme;

    try {
      localStorage.setItem('tr-theme', safeTheme);
    } catch (_) {}

    const icon = safeTheme === 'light'
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';

    ['#themeToggle', '#appThemeToggle'].forEach(selector => {
      const button = $(selector);
      if (button) button.innerHTML = icon;
    });
  }

  function toggleTheme() {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  }

  $('#themeToggle')?.addEventListener('click', toggleTheme);
  $('#appThemeToggle')?.addEventListener('click', toggleTheme);

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function setMessage(message = '', isError = true) {
    authMessage.textContent = message;
    authMessage.style.color = isError ? '#e99c9c' : 'var(--success)';
  }

  function setMode(mode) {
    authMode = mode === 'register' ? 'register' : 'login';
    const registering = authMode === 'register';

    loginTab.classList.toggle('active', !registering);
    registerTab.classList.toggle('active', registering);
    loginTab.setAttribute('aria-selected', String(!registering));
    registerTab.setAttribute('aria-selected', String(registering));

    nameField.classList.toggle('hidden', !registering);
    extraFields.classList.toggle('hidden', !registering);

    $('#studentName').required = registering;
    $('#studentGrade').required = registering;
    $('#studentGender').required = registering;
    passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
    submitText.textContent = registering ? 'إنشاء حساب والدخول' : 'ادخل المنصة';
    setMessage('');
  }

  loginTab.addEventListener('click', () => setMode('login'));
  registerTab.addEventListener('click', () => setMode('register'));

  $('#passwordToggle')?.addEventListener('click', () => {
    const reveal = passwordInput.type === 'password';
    passwordInput.type = reveal ? 'text' : 'password';
    $('#passwordToggle').innerHTML = reveal
      ? '<i class="fa-regular fa-eye-slash"></i>'
      : '<i class="fa-regular fa-eye"></i>';
    $('#passwordToggle').setAttribute('aria-label', reveal ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
  });

  function normalizePhone(value) {
    return String(value)
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/\s+/g, '')
      .trim();
  }

  function validateForm() {
    const phone = normalizePhone($('#studentPhone').value);
    const password = passwordInput.value;

    if (!/^01[0125]\d{8}$/.test(phone)) {
      throw new Error('اكتب رقم موبايل مصري صحيح مكوّن من 11 رقم.');
    }

    if (password.length < 8 || password.length > 72) {
      throw new Error('كلمة المرور لازم تكون من 8 إلى 72 حرفًا أو رقمًا.');
    }

    const result = { phone, password };

    if (authMode === 'register') {
      const name = $('#studentName').value.trim().replace(/\s+/g, ' ');

      if (name.length < 5 || name.split(' ').length < 3) {
        throw new Error('اكتب اسمك الثلاثي بشكل صحيح.');
      }

      if (name.length > 90) {
        throw new Error('الاسم أطول من المسموح.');
      }

      result.name = name;
      result.grade = $('#studentGrade').value;
      result.gender = $('#studentGender').value;
    }

    return result;
  }

  async function apiRequest(path, body) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || 'حصلت مشكلة. جرّب تاني بعد شوية.');
    }

    return payload;
  }

  function showApp(profile) {
    const name = typeof profile.name === 'string' ? profile.name : 'طالبنا العزيز';
    const grade = typeof profile.grade === 'string' ? profile.grade : 'غير محدد';
    const gender = profile.gender === 'female' ? 'female' : 'male';

    document.body.classList.toggle('theme-female', gender === 'female');
    $('#displayName').textContent = name;
    $('#profileName').textContent = name;
    $('#profileGrade').textContent = grade;
    $('#profileStatus').textContent = profile.serverAccount ? 'حساب محفوظ' : 'وضع تجريبي';

    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      appScreen.animate(
        [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 400, easing: 'ease-out' }
      );
    }
  }

  async function checkExistingSession() {
    if (!API_ENABLED) return;

    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data && data.user) {
        showApp({ ...data.user, serverAccount: true });
      }
    } catch (_) {
      // الخادم غير متاح؛ تظل شاشة الدخول ظاهرة.
    }
  }

  authForm.addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('');

    let payload;
    try {
      payload = validateForm();
    } catch (error) {
      setMessage(error.message);
      return;
    }

    submitBtn.disabled = true;
    submitText.textContent = authMode === 'register' ? 'جارٍ إنشاء الحساب...' : 'جارٍ تسجيل الدخول...';

    try {
      if (API_ENABLED) {
        const endpoint = authMode === 'register'
          ? '/api/auth/register'
          : '/api/auth/login';

        const data = await apiRequest(endpoint, payload);

        if (!data.user) throw new Error('الخادم رجّع بيانات غير مكتملة.');

        showApp({ ...data.user, serverAccount: true });
        showToast(authMode === 'register' ? 'حسابك اتعمل واتحفظ على الخادم.' : 'تم تسجيل الدخول بنجاح.');
      } else {
        // معاينة واجهة فقط: لا يتم إنشاء حساب حقيقي أو حفظ بيانات حساب على خادم.
        const preview = {
          name: authMode === 'register' ? payload.name : 'طالب المعاينة',
          grade: authMode === 'register' ? payload.grade : 'معاينة محلية',
          gender: authMode === 'register' ? payload.gender : 'male',
          serverAccount: false
        };

        showApp(preview);
        showToast('أنت في وضع المعاينة؛ شغّل الخادم لحفظ الحسابات فعليًا.');
      }
    } catch (error) {
      setMessage(error.message || 'تعذّر إكمال العملية.');
    } finally {
      submitBtn.disabled = false;
      submitText.textContent = authMode === 'register' ? 'إنشاء حساب والدخول' : 'ادخل المنصة';
    }
  });

  // المساعدة والدعم
  const helpModal = $('#helpModal');

  function openHelp() {
    helpModal.classList.remove('hidden');
    $('#closeHelp').focus();
  }

  function closeHelp() {
    helpModal.classList.add('hidden');
  }

  $$('[data-open-help]').forEach(button => button.addEventListener('click', openHelp));
  $('#helpButton')?.addEventListener('click', openHelp);
  $('#closeHelp')?.addEventListener('click', closeHelp);

  helpModal?.addEventListener('click', event => {
    if (event.target === helpModal) closeHelp();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeHelp();
      $('#mobileNav')?.classList.add('hidden');
    }
  });

  // القائمة على الهاتف والتابلت.
  const mobileMenuButton = $('#mobileMenuButton');
  const mobileNav = $('#mobileNav');

  mobileMenuButton?.addEventListener('click', () => {
    const opening = mobileNav.classList.contains('hidden');
    mobileNav.classList.toggle('hidden', !opening);
    mobileMenuButton.setAttribute('aria-expanded', String(opening));
    mobileMenuButton.innerHTML = opening
      ? '<i class="fa-solid fa-xmark"></i>'
      : '<i class="fa-solid fa-bars"></i>';
  });

  $$('#mobileNav a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.add('hidden');
      mobileMenuButton?.setAttribute('aria-expanded', 'false');
      if (mobileMenuButton) mobileMenuButton.innerHTML = '<i class="fa-solid fa-bars"></i>';
    });
  });

  // إنهاء الجلسة على الخادم عند تفعيله.
  $('#logoutBtn')?.addEventListener('click', async () => {
    const confirmed = window.confirm('متأكد إنك عايز تخرج من المنصة؟');
    if (!confirmed) return;

    if (API_ENABLED) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store'
        });
      } catch (_) {}
    }

    appScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    authForm.reset();
    setMode('login');
    document.body.classList.remove('theme-female');
    showToast('تم تسجيل الخروج.');
  });

  // روابط القائمة النشطة.
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        $$('.nav-link').forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });

    ['home', 'learning', 'updates', 'community'].forEach(id => {
      const section = document.getElementById(id);
      if (section) navObserver.observe(section);
    });
  }

  $$('.year').forEach(element => {
    element.textContent = new Date().getFullYear();
  });

  // حركات الظهور التدريجي مع احترام إعداد تقليل الحركة.
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    $$('.feature-card,.update-card,.profile-strip,.community').forEach(element => {
      element.classList.add('reveal-on-scroll');
      revealObserver.observe(element);
    });
  }

  setTheme(document.documentElement.dataset.theme || 'dark');
  setMode('login');
  checkExistingSession();
})();
