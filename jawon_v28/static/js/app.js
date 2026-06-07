const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

const ROLE_LABELS = {
  admin: '관리자',
  personal: '개인',
  partner: '업체',
  agency: '기관',
  enterprise: '기업'
};

const DEMO_ACCOUNTS = {
  brans911: {
    id: 'brans911', password: 'brans911!', name: '관리자', displayName: '관리자님', role: 'admin', plan: 'Admin', status: 'approved', token: 'demo-admin', email: 'admin@jawonitda.kr', phone: '010-0000-0000'
  },
  personal: {
    id: 'personal', password: 'personal123!', name: '김예찬', displayName: '김예찬님', role: 'personal', plan: 'Free', status: 'approved', token: 'demo-personal', email: 'personal@example.com', phone: '010-1111-2222'
  },
  partner: {
    id: 'partner', password: 'partner123!', name: '광주그린자원', displayName: '광주그린자원님', role: 'partner', plan: 'Gold', status: 'approved', token: 'demo-partner', email: 'partner@example.com', phone: '062-000-1111'
  },
  agency: {
    id: 'agency', password: 'agency123!', name: '광주광역시청', displayName: '광주광역시청님', role: 'agency', plan: 'Pro', status: 'approved', token: 'demo-agency', email: 'agency@example.go.kr', phone: '062-000-2222'
  },
  samsung: {
    id: 'samsung', password: 'samsung123!', name: '삼성전자', displayName: '삼성전자님', role: 'enterprise', plan: 'ESG Plus', status: 'approved', token: 'demo-enterprise', email: 'samsung@example.com', phone: '02-0000-0000'
  },
  enterprise: {
    id: 'enterprise', password: 'enterprise123!', name: '해빛산업', displayName: '해빛산업님', role: 'enterprise', plan: 'ESG Plus', status: 'approved', token: 'demo-enterprise2', email: 'esg@example.com', phone: '02-1111-2222'
  }
};

const store = {
  get user() {
    try { return JSON.parse(localStorage.getItem('jawon_user') || 'null'); }
    catch { return null; }
  },
  set user(v) {
    if (v) localStorage.setItem('jawon_user', JSON.stringify(v));
    else localStorage.removeItem('jawon_user');
  }
};

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function rel(path) {
  const depth = location.pathname.includes('/dashboards/') || location.pathname.includes('/policies/') ? '../' : '';
  return depth + path;
}

function apiBase() {
  return localStorage.getItem('jawon_api_base') || '';
}

async function postJSON(path, body) {
  try {
    const response = await fetch(apiBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('safe mock fallback', error);
    return null;
  }
}

async function getJSON(path, fallback) {
  try {
    const response = await fetch(apiBase() + path);
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return await response.json();
  } catch (error) {
    try {
      const local = await fetch(path.replace('/api/', 'data/') + '.json');
      return await local.json();
    } catch (_) {
      return fallback;
    }
  }
}

function normalizeUser(user) {
  if (!user) return null;
  const role = user.role || 'personal';
  const label = ROLE_LABELS[role] || '회원';
  const name = user.name || user.organization || user.id || label;
  return {
    ...user,
    role,
    name,
    displayName: user.displayName || `${name}님`,
    roleLabel: label,
    plan: user.plan || (role === 'admin' ? 'Admin' : 'Free'),
    status: user.status || 'approved'
  };
}

function dashboardPath(role) {
  return rel({
    admin: 'dashboards/admin.html',
    personal: 'dashboards/personal.html',
    partner: 'dashboards/partner.html',
    agency: 'dashboards/agency.html',
    enterprise: 'dashboards/enterprise.html'
  }[role] || 'index.html');
}


const PLAN_LEVELS = {
  personal: { Free: 0, Smart: 1, Premium: 2, 'Family/Small Office': 3 },
  partner: { Free: 0, Basic: 1, Standard: 2, Plus: 3, Gold: 4 },
  agency: { Free: 0, Basic: 1, Standard: 2, Pro: 3, Enterprise: 4 },
  enterprise: { Free: 0, Basic: 1, Standard: 2, 'ESG Plus': 3, Enterprise: 4 },
  admin: { Admin: 99 }
};

const FEATURE_RULES = {
  'agency-intake': { label: '기관 업무공간', roles: ['agency'], min: { agency: 'Basic' } },
  'partner-workspace': { label: '업체 업무공간', roles: ['partner'], min: { partner: 'Basic' } },
  'enterprise-esg': { label: '기업 업무공간', roles: ['enterprise'], min: { enterprise: 'Basic' } },
  bidrooms: { label: '입찰방', roles: ['partner'], min: { partner: 'Basic' } },
  'pickup-map': { label: '수거지도', roles: ['partner', 'enterprise'], min: { partner: 'Standard', enterprise: 'Standard' } },
  route: { label: '최적노선', roles: ['partner', 'enterprise'], min: { partner: 'Plus', enterprise: 'ESG Plus' } },
  documents: { label: '보호자료센터', roles: ['partner', 'agency', 'enterprise'], min: { partner: 'Standard', agency: 'Basic', enterprise: 'Standard' } }
};

function planLevel(role, plan) {
  if (role === 'admin') return 99;
  return (PLAN_LEVELS[role] && PLAN_LEVELS[role][plan]) ?? 0;
}

function canUseFeature(user, featureKey) {
  user = normalizeUser(user);
  if (!user) return false;
  if (user.role === 'admin') return true;
  const rule = FEATURE_RULES[featureKey];
  if (!rule) return true;
  if (!rule.roles.includes(user.role)) return false;
  const required = rule.min?.[user.role] || 'Free';
  return planLevel(user.role, user.plan) >= planLevel(user.role, required);
}

function lockedHref(user, featureKey, target) {
  return canUseFeature(user, featureKey) ? target : rel('pricing.html');
}

function renderMainMenu() {
  const menu = $('.menu');
  if (!menu) return;
  const user = normalizeUser(store.user);
  const base = [
    ['index.html', '홈'],
    ['pickup.html', '사진수거'],
    ['campaigns.html', '캠페인'],
    ['pricing.html', '요금제'],
    ['notices.html', '공지'],
    ['help.html', '고객센터']
  ];
  let roleLinks = [];
  if (user) {
    roleLinks.push([dashboardPath(user.role).replace(rel(''), ''), `${user.roleLabel} 업무홈`]);
    if (user.role === 'admin') {
      roleLinks.push(['bidrooms.html', '입찰방관리'], ['pickup-map.html', '수거지도'], ['route.html', '최적노선'], ['dashboards/documents.html', '보호자료']);
    } else if (user.role === 'partner') {
      roleLinks.push(
        [lockedHref(user, 'bidrooms', 'bidrooms.html').replace(rel(''), ''), canUseFeature(user, 'bidrooms') ? '입찰방' : '입찰방🔒'],
        [lockedHref(user, 'pickup-map', 'pickup-map.html').replace(rel(''), ''), canUseFeature(user, 'pickup-map') ? '수거지도' : '수거지도🔒'],
        [lockedHref(user, 'route', 'route.html').replace(rel(''), ''), canUseFeature(user, 'route') ? '최적노선' : '최적노선🔒'],
        [lockedHref(user, 'documents', 'dashboards/documents.html').replace(rel(''), ''), canUseFeature(user, 'documents') ? '보호자료' : '보호자료🔒']
      );
    } else if (user.role === 'agency') {
      roleLinks.push(
        [lockedHref(user, 'agency-intake', 'agency.html').replace(rel(''), ''), canUseFeature(user, 'agency-intake') ? 'AI 서류작성' : 'AI 서류작성🔒'],
        [lockedHref(user, 'documents', 'dashboards/documents.html').replace(rel(''), ''), canUseFeature(user, 'documents') ? '보호자료' : '보호자료🔒']
      );
    } else if (user.role === 'enterprise') {
      roleLinks.push(
        [lockedHref(user, 'enterprise-esg', 'enterprise.html').replace(rel(''), ''), canUseFeature(user, 'enterprise-esg') ? 'ESG 관리' : 'ESG 관리🔒'],
        [lockedHref(user, 'pickup-map', 'pickup-map.html').replace(rel(''), ''), canUseFeature(user, 'pickup-map') ? '수거지도' : '수거지도🔒'],
        [lockedHref(user, 'route', 'route.html').replace(rel(''), ''), canUseFeature(user, 'route') ? '최적노선' : '최적노선🔒'],
        [lockedHref(user, 'documents', 'dashboards/documents.html').replace(rel(''), ''), canUseFeature(user, 'documents') ? '보호자료' : '보호자료🔒']
      );
    } else if (user.role === 'personal') {
      roleLinks.push(['pickup.html', '수거신청'], ['campaigns.html', '캠페인참여']);
    }
  }
  const links = user ? [base[0], ...roleLinks, ...base.slice(1)] : base;
  menu.innerHTML = links.map(([href, label]) => `<a href="${rel(href)}">${escapeHTML(label)}</a>`).join('');
}

function roleSideLinks(user) {
  user = normalizeUser(user);
  const common = [[dashboardPath(user.role).replace('../',''), `${user.roleLabel} 업무홈`, true]];
  if (user.role === 'admin') return [
    ['admin.html', '운영관제', true],
    ['admin.html#members', '회원·자격관리', true],
    ['../bidrooms.html', '입찰방 관리', true],
    ['../pickup-map.html', '수거지도 관리', true],
    ['../route.html', '수거노선 시뮬레이션', true],
    ['documents.html', '보호자료 전체', true],
    ['../notices.html', '공지자료', true],
    ['../help.html', '문의답변', true],
    ['../settings.html', '관리자 설정', true]
  ];
  if (user.role === 'partner') return [
    ['partner.html', '업체 홈', true],
    ['../bidrooms.html', '입찰방', canUseFeature(user, 'bidrooms')],
    ['../pickup-map.html', '수거지도', canUseFeature(user, 'pickup-map')],
    ['../route.html', '최적노선', canUseFeature(user, 'route')],
    ['documents.html', '보호자료센터', canUseFeature(user, 'documents')],
    ['partner.html#settlement', '정산·수수료', true],
    ['../settings.html', '업체 정보 설정', true]
  ];
  if (user.role === 'agency') return [
    ['agency.html', '기관 홈', true],
    ['../agency.html', 'AI 서류 자동작성', canUseFeature(user, 'agency-intake')],
    ['documents.html', '보호자료센터', canUseFeature(user, 'documents')],
    ['agency.html#review', '내부 검토자료', true],
    ['../settings.html', '기관 정보 설정', true]
  ];
  if (user.role === 'enterprise') return [
    ['enterprise.html', '기업 홈', true],
    ['../enterprise.html', 'ESG·정기수거', canUseFeature(user, 'enterprise-esg')],
    ['../pickup-map.html', '수거지도', canUseFeature(user, 'pickup-map')],
    ['../route.html', '최적노선', canUseFeature(user, 'route')],
    ['documents.html', '보호자료센터', canUseFeature(user, 'documents')],
    ['../settings.html', '기업 정보 설정', true]
  ];
  return [
    ['personal.html', '개인 홈', true],
    ['../pickup.html', '사진수거 신청', true],
    ['../campaigns.html', '캠페인 참여', true],
    ['../settings.html', '내 정보 설정', true]
  ];
}

function renderDashboardSide() {
  const side = $('.side');
  const user = normalizeUser(store.user);
  if (!side || !user) return;
  const current = location.pathname.split('/').pop();
  const title = user.role === 'admin' ? '관리자 운영센터' : `${user.roleLabel} 업무공간`;
  side.innerHTML = `
    <img alt="자원잇다" src="../assets/jawonitda-logo.png"/>
    <h3>${escapeHTML(title)}</h3>
    <p class="side-user"><b>${escapeHTML(user.displayName)}</b><br><span>${escapeHTML(user.plan)} 플랜 · ${escapeHTML(user.status)}</span></p>
    ${roleSideLinks(user).map(([href, label, allowed]) => allowed
      ? `<a class="${href.endsWith(current) ? 'active' : ''}" href="${href}">${escapeHTML(label)}</a>`
      : `<a class="locked" href="../pricing.html">${escapeHTML(label)} <small>플랜 필요</small></a>`).join('')}
    <a href="../index.html">홈으로</a>
  `;
}

function protectFeaturePage() {
  const key = document.body?.dataset?.feature;
  if (!key) return;
  const user = normalizeUser(store.user);
  const rule = FEATURE_RULES[key];
  if (!user || !canUseFeature(user, key)) {
    const main = $('#main');
    const label = rule?.label || '보호 기능';
    const msg = !user ? '로그인 후 이용할 수 있습니다.' : `${user.roleLabel} · ${user.plan} 플랜에서는 아직 열리지 않은 기능입니다.`;
    if (main) {
      main.innerHTML = `<section class="section"><div class="container"><div class="card access-denied"><span class="badge">권한 필요</span><h1>${escapeHTML(label)}</h1><p>${escapeHTML(msg)}</p><p>기관·업체·기업·관리자 기능은 공개 메뉴가 아니라 로그인 후 역할과 요금제에 따라 열립니다.</p><div class="hero-actions"><a class="btn primary" href="${rel(user ? 'pricing.html' : 'login.html')}">${user ? '요금제 확인' : '로그인하기'}</a><a class="btn ghost" href="${rel('index.html')}">홈으로</a></div></div></div></section>`;
    }
  }
}

function initAccountBar() {
  renderMainMenu();
  const actions = $('.actions');
  if (!actions) return;
  const user = normalizeUser(store.user);
  if (!user) {
    actions.innerHTML = `
      <a class="btn ghost desktop-only" href="${rel('login.html')}">로그인</a>
      <a class="btn primary desktop-only" href="${rel('signup.html')}">회원가입</a>
      <button class="btn ghost mobile-toggle" type="button">메뉴</button>
    `;
    return;
  }
  actions.innerHTML = `
    <a class="account-pill" href="${dashboardPath(user.role)}" title="${escapeHTML(user.displayName)} 대시보드">
      <strong>${escapeHTML(user.displayName)}</strong><span>${escapeHTML(user.roleLabel)}</span>
    </a>
    <a class="btn ghost desktop-only" href="${rel('settings.html')}">내 설정</a>
    <button class="btn ghost desktop-only" id="logoutBtn" type="button">로그아웃</button>
    <button class="btn ghost mobile-toggle" type="button">메뉴</button>
  `;
  $('#logoutBtn')?.addEventListener('click', () => {
    store.user = null;
    location.href = rel('index.html');
  });
}

function initNav() {
  renderMainMenu();
  const toggle = $('.mobile-toggle');
  const menu = $('.menu');
  if (toggle && menu) toggle.onclick = () => menu.classList.toggle('open');
  const file = location.pathname.split('/').pop() || 'index.html';
  $$('.menu a').forEach(a => {
    if (a.getAttribute('href')?.endsWith(file)) a.classList.add('active');
  });
  $$('[data-requires-login]').forEach(el => {
    el.addEventListener('click', event => {
      if (!store.user) {
        event.preventDefault();
        location.href = rel('login.html');
      }
    });
  });
}

function initRoleExperience() {
  protectFeaturePage();
  const user = normalizeUser(store.user);
  const isDashboard = location.pathname.includes('/dashboards/');
  if (isDashboard && !user) {
    location.href = '../login.html';
    return;
  }
  if (user) {
    $$('[data-user-name]').forEach(el => { el.textContent = user.displayName; });
    $$('[data-user-role]').forEach(el => { el.textContent = user.roleLabel; });
    $$('[data-user-plan]').forEach(el => { el.textContent = user.plan; });
  }
  if (!isDashboard || !user) return;

  const pageRole = document.body.dataset.role;
  const currentFile = location.pathname.split('/').pop();
  if (currentFile !== 'documents.html' && pageRole && pageRole !== user.role && user.role !== 'admin') {
    location.href = dashboardPath(user.role);
    return;
  }

  renderDashboardSide();
  const dashHead = $('.dash-head');
  if (dashHead && !$('.user-ribbon')) {
    dashHead.insertAdjacentHTML('afterend', `
      <div class="user-ribbon">
        <div><b>${escapeHTML(user.displayName)}</b> · ${escapeHTML(user.roleLabel)} · ${escapeHTML(user.plan)} 플랜</div>
        <a class="btn small ghost" href="${rel('settings.html')}">내 정보·비밀번호 설정</a>
      </div>
    `);
  }

  const roleFiles = {
    personal: 'personal.html',
    partner: 'partner.html',
    agency: 'agency.html',
    enterprise: 'enterprise.html',
    admin: 'admin.html'
  };
  $$('.side a').forEach(link => {
    const href = link.getAttribute('href') || '';
    const isRoleDash = ['personal.html', 'partner.html', 'agency.html', 'enterprise.html', 'admin.html'].some(x => href.endsWith(x));
    if (user.role !== 'admin' && isRoleDash && !href.endsWith(roleFiles[user.role])) {
      link.style.display = 'none';
    }
    if (href.endsWith('documents.html') && user.role === 'personal') {
      link.style.display = 'none';
    }
  });
  const side = $('.side');
  if (side && !$('.side-settings-link')) {
    const home = [...side.querySelectorAll('a')].find(a => a.textContent.includes('홈으로'));
    const settingsLink = document.createElement('a');
    settingsLink.href = '../settings.html';
    settingsLink.className = 'side-settings-link';
    settingsLink.textContent = '내 설정';
    if (home) side.insertBefore(settingsLink, home); else side.appendChild(settingsLink);
  }
}

function initLogin() {
  const form = $('#loginForm');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('#loginId').value.trim();
    const password = $('#loginPw').value;
    let data = await postJSON('/api/auth/login', { id, password });
    if (!data) {
      const demo = DEMO_ACCOUNTS[id];
      if (demo && demo.password === password) data = { ...demo };
      else data = { id, name: id || '데모회원', displayName: `${id || '데모회원'}님`, role: 'personal', plan: 'Free', status: 'approved', token: 'demo-' + Date.now() };
    }
    data = normalizeUser(data);
    store.user = data;
    location.href = dashboardPath(data.role);
  });
  $$('.demo-login').forEach(btn => {
    btn.addEventListener('click', () => {
      const account = DEMO_ACCOUNTS[btn.dataset.account];
      if (!account) return;
      $('#loginId').value = account.id;
      $('#loginPw').value = account.password;
    });
  });
}

function initSettings() {
  const form = $('#settingsForm');
  if (!form) return;
  let user = normalizeUser(store.user);
  if (!user) {
    location.href = 'login.html';
    return;
  }
  $('#profileRole').textContent = user.roleLabel;
  $('#profilePlan').textContent = user.plan;
  $('#profileStatus').textContent = user.status === 'approved' ? '승인완료' : user.status;
  $('#profileName').value = user.name || '';
  $('#profileDisplayName').value = user.displayName || `${user.name || user.id}님`;
  $('#profileEmail').value = user.email || '';
  $('#profilePhone').value = user.phone || '';
  $('#profileAddress').value = user.address || '';
  $('#profileMemo').value = user.memo || '';
  $('#profileId').textContent = user.id || '-';

  form.addEventListener('submit', event => {
    event.preventDefault();
    user = normalizeUser(store.user);
    user.name = $('#profileName').value.trim() || user.name;
    user.displayName = $('#profileDisplayName').value.trim() || `${user.name}님`;
    user.email = $('#profileEmail').value.trim();
    user.phone = $('#profilePhone').value.trim();
    user.address = $('#profileAddress').value.trim();
    user.memo = $('#profileMemo').value.trim();
    const newPw = $('#newPassword').value.trim();
    if (newPw) user.localPasswordChanged = true;
    store.user = user;
    $('#settingsResult').innerHTML = `<div class="notice-banner">저장되었습니다. 상단에는 이제 <b>${escapeHTML(user.displayName)}</b>으로 표시됩니다.</div>`;
    initAccountBar();
    initNav();
  });
}

function initSignup() {
  const role = $('#signupRole');
  if (!role) return;
  const render = () => {
    $$('.role-fields').forEach(block => { block.style.display = block.dataset.role === role.value ? 'grid' : 'none'; });
  };
  role.addEventListener('change', render);
  render();
  $('#signupForm')?.addEventListener('submit', event => {
    event.preventDefault();
    alert('가입 신청이 접수되었습니다. 관리자 심사 후 승인됩니다.');
    location.href = 'login.html';
  });
}

function pickupLocal(body) {
  const weight = +body.weight || 0;
  const value = +body.value || 0;
  const count = +body.count || 0;
  const bulky = !!body.bulky;
  const score = weight * 2 + value / 1000 + count * 8 + (bulky ? 40 : 0);
  const eligible = weight >= 20 || value >= 10000 || count >= 5 || bulky;
  return {
    eligible,
    score,
    decision: eligible ? '즉시 수거 매칭 가능' : '묶음수거 대기 또는 캠페인 참여 권장',
    reason: eligible ? '수거 기준을 충족했습니다. 업체 매칭으로 넘어갈 수 있습니다.' : '기준 미달입니다. 같은 품목을 모으거나 캠페인 참여를 추천합니다.'
  };
}

function initPickup() {
  const btn = $('#eligibilityBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const body = { item: $('#item')?.value, weight: $('#weight')?.value, value: $('#value')?.value, count: $('#count')?.value, bulky: $('#bulky')?.checked };
    const data = await postJSON('/api/pickup/eligibility', body) || pickupLocal(body);
    $('#eligibilityResult').innerHTML = `<div class="card"><span class="status ${data.eligible ? 'ok' : 'wait'}">${data.decision}</span><h3>판정 점수 ${Math.round(data.score || 0)}</h3><p>${data.reason}</p><div class="hero-actions"><button class="btn primary">${data.eligible ? '수거 매칭 요청' : '묶음수거 대기 등록'}</button><a class="btn ghost" href="campaigns.html">캠페인 보기</a></div></div>`;
  });
}

function initAutoFill() {
  const btn = $('#autoFillBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const body = { role: store.user?.role || document.body.dataset.role || 'agency', organization: $('#orgName')?.value, purpose: $('#purpose')?.value, items: $('#items')?.value, location: $('#location')?.value, dates: $('#dates')?.value, amount: $('#amount')?.value };
    const data = await postJSON('/api/intake/auto-fill', body) || { title: 'AI 자동작성 후보', summary: '최소 입력값을 바탕으로 담당자 검토용 서류 초안을 생성했습니다.', fields: body, documents: ['공고정보 입력표', '물건정보 입력표', '예정가격 산정근거표'], next: ['누락정보 보완', '담당자 검토', '요금제 권한 확인', '기관 제출용 PDF 생성'] };
    $('#autoFillResult').innerHTML = `<div class="card"><span class="badge">검토용 초안</span><h3>${data.title}</h3><p>${data.summary}</p><div class="grid-2">${Object.entries(data.fields || {}).map(([k, v]) => `<div class="card soft"><b>${escapeHTML(k)}</b><p>${escapeHTML(v || '-')}</p></div>`).join('')}</div><h3>추천 생성 서류</h3><p>${(data.documents || []).map(escapeHTML).join(' · ')}</p><div>${(data.next || []).map(x => `<span class="status ok" style="margin-right:6px">${escapeHTML(x)}</span>`).join('')}</div></div>`;
  });
}

function initPricing() {
  const grid = $('#pricingGrid');
  if (!grid) return;
  fetch(rel('data/plans.json')).then(r => r.json()).then(plans => {
    const select = $('#planType');
    function render(type) {
      grid.innerHTML = (plans[type] || []).map(p => `<div class="card price-card"><span class="badge">${type}</span><h3>${p.name}</h3><div class="price">${p.price}</div>${p.fee && p.fee !== '-' ? `<div class="fee">중계수수료 ${p.fee}</div>` : ''}<ul>${p.features.map(f => `<li>${f}</li>`).join('')}</ul><button class="btn primary" onclick="alert('${p.name} 결제 준비 화면입니다. 실제 PG 키 연결 후 결제됩니다.')">플랜 선택하기</button></div>`).join('');
    }
    render(select?.value || 'partner');
    select?.addEventListener('change', e => render(e.target.value));
  });
}

function initForms() {
  const wrap = $('#formsList');
  if (!wrap) return;
  fetch(rel('data/forms.json')).then(r => r.json()).then(forms => {
    const user = normalizeUser(store.user) || { role: document.body.dataset.role || 'personal', plan: 'Free' };
    wrap.innerHTML = forms.map(f => {
      const ok = user.role === 'admin' || ((f.roles.includes(user.role)) && (f.plans.includes(user.plan) || f.plans.some(req => planLevel(user.role, user.plan) >= planLevel(user.role, req))));
      return `<div class="doc-lock"><div><b>${f.name}</b><p>${f.range}번 · 허용 역할: ${f.roles.map(r => ROLE_LABELS[r] || r).join(', ')} · 필요 플랜: ${f.plans.join(', ')}</p></div><button class="btn ${ok ? 'primary' : 'ghost'}" onclick="${ok ? `location.href='${apiBase()}/api/protected/forms/${f.id}?token=${user.token || 'demo-admin'}'` : `alert('승인상태 또는 요금제를 확인하세요.')`}">${ok ? '자동작성/다운로드' : '잠김'}</button></div>`;
    }).join('');
  });
}

function initRoute() {
  const btn = $('#routeBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const stops = $$('#routeStops input').map(i => i.value.trim()).filter(Boolean);
    const mode = $('#routeMode').value;
    const data = await postJSON('/api/route/optimize', { stops, mode }) || { mode, stops: stops.length ? stops : ['상무지구 고객 A', '광주광역시청', '치평동 사무실', '쌍촌동 업체'], distance_km: 18.6, profit_score: 87, eta: '2시간 10분', recommendation: mode === 'profit' ? '수익성 우선 노선' : mode === 'time' ? '방문시간 우선 노선' : '최단거리 우선 노선' };
    $('#routeResult').innerHTML = `<div class="card"><span class="badge blue">${data.mode}</span><h3>${data.recommendation}</h3><p>총 거리 ${data.distance_km}km · 예상 ${data.eta} · 수익점수 ${data.profit_score}</p><ol>${data.stops.map(s => `<li>${escapeHTML(s)}</li>`).join('')}</ol></div>`;
  });
}

function initMap() {
  const map = $('#partnerMap');
  if (!map) return;
  fetch(rel('data/partners.json')).then(r => r.json()).then(list => {
    map.innerHTML = '<div class="route-line" style="left:18%;top:42%;width:58%;transform:rotate(-8deg)"></div><div class="route-line" style="left:24%;top:58%;width:44%;transform:rotate(15deg)"></div>' + list.map((p, i) => `<div class="pin" style="left:${12 + i * 18}%;top:${24 + (i % 3) * 18}%">${p.name}<br><small>${p.area} · ${p.plan}</small></div>`).join('');
    const table = $('#partnerTable');
    if (table) table.innerHTML = list.map(p => `<tr><td>${p.name}</td><td>${p.area}</td><td>${p.items}</td><td>${p.fleet}</td><td>${p.plan}</td><td>${p.score}</td></tr>`).join('');
  });
}

function initPriceSim() {
  const btn = $('#priceSimBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const body = { market_price: +$('#market').value, qty: +$('#qty').value, refund_rate: +$('#refund').value, logistics: +$('#logistics').value, risk: +$('#risk').value, fee_rate: +$('#fee').value };
    const data = await postJSON('/api/admin/price/simulate', body) || (() => {
      const total = body.market_price * body.qty;
      const recommend = Math.max(0, total * body.refund_rate - body.logistics - body.risk);
      const fee = recommend * body.fee_rate;
      const profit = total - recommend - body.logistics - body.risk + fee;
      return { total, recommend, fee, profit, advice: profit < 10000 ? '단가 낮춤·묶음수거·처리비 안내 권장' : '매입 가능' };
    })();
    $('#priceSimResult').innerHTML = `<div class="kpi"><div class="card"><span>총시세</span><b>${Math.round(data.total).toLocaleString()}원</b></div><div class="card"><span>추천 매입가</span><b>${Math.round(data.recommend).toLocaleString()}원</b></div><div class="card"><span>수수료</span><b>${Math.round(data.fee).toLocaleString()}원</b></div><div class="card"><span>예상 이익</span><b>${Math.round(data.profit).toLocaleString()}원</b></div></div><p class="notice-banner">${data.advice}</p>`;
  });
}

function initAdmin() {
  const memberTable = $('#memberTable');
  if (memberTable) {
    const rows = [['광주광역시청', '기관', 'Standard', '심사중', '72'], ['광주그린자원', '업체', 'Gold', '승인', '94'], ['삼성전자', '기업', 'ESG Plus', '보완요청', '80'], ['김예찬', '개인', 'Free', '승인', '60']];
    memberTable.innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td><select class="select"><option>${r[2]}</option><option>Free</option><option>Basic</option><option>Standard</option><option>Plus</option><option>Gold</option><option>Pro</option><option>ESG Plus</option></select></td><td><select class="select"><option>${r[3]}</option><option>승인</option><option>심사중</option><option>보완요청</option><option>정지</option></select></td><td><input class="input" value="${r[4]}" style="width:90px"></td><td><button class="btn small primary">저장</button></td></tr>`).join('');
  }
  const inquiryTable = $('#inquiryTable');
  if (inquiryTable) {
    const list = JSON.parse(localStorage.getItem('jawon_inquiries') || '[]');
    const rows = list.length ? list : [{ created: '오늘', body: '기관 서류 자동작성 견적 문의', status: '대기', answer: '' }];
    inquiryTable.innerHTML = rows.map(q => `<tr><td>${q.created || '-'}</td><td>${escapeHTML(q.body)}</td><td>${q.status}</td><td><input class="input" value="${escapeHTML(q.answer || '')}" placeholder="답변 입력"></td><td><button class="btn small primary">답변저장</button></td></tr>`).join('');
  }
}

function initCampaigns() {
  const wrap = $('#campaignList');
  if (!wrap) return;
  fetch(rel('data/campaigns.json')).then(r => r.json()).then(list => {
    wrap.innerHTML = list.map(c => `<div class="card"><span class="badge">${c.status}</span><h3>${c.title}</h3><p>${c.desc}</p><div class="progress"><span style="width:${Math.min(100, Math.round((c.participants / c.target) * 100))}%"></span></div><p>${c.participants}/${c.target}명 참여</p><button class="btn primary" onclick="alert('캠페인 참여가 접수되었습니다.')">참여하기</button></div>`).join('');
  });
}

function initNotices() {
  const wrap = $('#noticeList');
  if (!wrap) return;
  fetch(rel('data/notices.json')).then(r => r.json()).then(list => {
    wrap.innerHTML = list.map(n => `<tr><td>${n.kind}</td><td><b>${n.title}</b><br><small>${n.file}</small></td><td>${n.date}</td><td><button class="btn small ghost" onclick="alert('관리자 등록 자료는 운영 저장소 연결 후 다운로드됩니다.')">보기</button></td></tr>`).join('');
  });
}

function initChat() {
  const toggle = $('#chatToggle');
  const box = $('#chatBox');
  if (toggle && box) toggle.addEventListener('click', () => box.classList.toggle('open'));
  const send = $('#chatSend');
  if (!send) return;
  send.addEventListener('click', async () => {
    const body = $('#chatText').value.trim();
    if (!body) return;
    const item = await postJSON('/api/inquiries', { body }) || { created: new Date().toLocaleString(), body, status: '대기', answer: '' };
    const list = JSON.parse(localStorage.getItem('jawon_inquiries') || '[]');
    list.unshift(item);
    localStorage.setItem('jawon_inquiries', JSON.stringify(list));
    $('#chatResult').textContent = '문의가 접수되었습니다. 관리자가 답변할 수 있습니다.';
    $('#chatText').value = '';
  });
}

function initApiStatus() {
  const wrap = $('#apiStatus');
  if (!wrap) return;
  getJSON('/api/admin/api-status', {}).then(data => {
    const keys = Object.keys(data).length ? Object.keys(data) : ['OPENAI_API_KEY', 'OCR_API_KEY', 'KAKAO_MAP_API_KEY', 'PORTONE_API_KEY', 'SOLAPI_API_KEY', 'BIZNO_API_KEY'];
    wrap.innerHTML = `<div class="grid-2">${keys.map(k => `<div class="card soft"><b>${k}</b><p>${data[k] ? '연결됨' : '미연결 · .env 설정 필요'}</p></div>`).join('')}</div>`;
  });
}

function initImageFallbacks() {
  $$('img').forEach(img => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      const fallback = document.createElement('div');
      fallback.className = 'image-fallback';
      fallback.textContent = '이미지 준비 중';
      img.insertAdjacentElement('afterend', fallback);
    }, { once: true });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initImageFallbacks();
  initAccountBar();
  initNav();
  initRoleExperience();
  initLogin();
  initSettings();
  initSignup();
  initPickup();
  initAutoFill();
  initPricing();
  initForms();
  initRoute();
  initMap();
  initPriceSim();
  initAdmin();
  initCampaigns();
  initNotices();
  initChat();
  initApiStatus();
});
