(() => {
  'use strict';

  // ================================================
  // 定数
  // ================================================
  const LS_CUSTOMERS = 'crm-customers';
  const LS_DEALS = 'crm-deals';
  const STATUS_ORDER = ['lead', 'proposal', 'won'];
  const STATUS_LABEL = { lead: '見込み', proposal: '提案', won: '成約' };

  // ================================================
  // 状態（メモリが正、保存時に localStorage へ書き戻す）
  // ================================================
  let customers = [];
  let deals = [];
  let selectedCustomerId = null;
  let editingCustomerId = null; // null のときは新規作成
  let editingDealId = null;     // null のときは新規作成
  let searchText = '';

  // ================================================
  // 汎用ユーティリティ
  // ================================================
  function $(id) { return document.getElementById(id); }

  function genId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatAmount(amount) {
    if (amount == null || amount === '') return '—';
    return '¥' + Number(amount).toLocaleString('ja-JP');
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function badgeClass(status) {
    if (status === 'lead') return 'bg-gray-100 text-gray-700';
    if (status === 'proposal') return 'bg-orange-100 text-[#c15f3c]';
    return 'bg-green-100 text-green-700';
  }

  // ================================================
  // localStorage I/O（画面側から直接 localStorage を触らない）
  // ================================================
  function loadCustomers() {
    try {
      const raw = localStorage.getItem(LS_CUSTOMERS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('loadCustomers failed', e);
      return [];
    }
  }

  function saveCustomers() {
    try {
      localStorage.setItem(LS_CUSTOMERS, JSON.stringify(customers));
    } catch (e) {
      console.error('saveCustomers failed', e);
    }
  }

  function loadDeals() {
    try {
      const raw = localStorage.getItem(LS_DEALS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('loadDeals failed', e);
      return [];
    }
  }

  function saveDeals() {
    try {
      localStorage.setItem(LS_DEALS, JSON.stringify(deals));
    } catch (e) {
      console.error('saveDeals failed', e);
    }
  }

  // ================================================
  // 初期データ投入
  // ================================================
  function seedIfEmpty() {
    if (customers.length > 0) return;
    const { seedCustomers, seedDeals } = buildSeedData();
    customers = seedCustomers;
    deals = seedDeals;
    saveCustomers();
    saveDeals();
  }

  function buildSeedData() {
    const now = Date.now();
    const c1 = makeSeedCustomer('株式会社ミヤビ電算', '佐伯 真一', '情報システム部 部長',
      'saeki@example.jp', '03-0000-1111', '年内に基幹システム刷新予定', now - 3000);
    const c2 = makeSeedCustomer('合同会社アオバ製作所', '三宅 千夏', '代表社員',
      'miyake@example.jp', '045-000-2222', '紹介経由、反応早め', now - 2000);
    const c3 = makeSeedCustomer('株式会社ツクモ商事', '黒田 遼', '営業企画課',
      'kuroda@example.jp', '06-0000-3333', '年度末に向けて予算確認中', now - 1000);
    const seedDeals = [
      makeSeedDeal(c1.id, '基幹系リプレース提案', 3500000, 'proposal', '次回は情シス全員で打ち合わせ'),
      makeSeedDeal(c1.id, '保守契約の見直し', 600000, 'lead', '現行契約は 6 月満了'),
      makeSeedDeal(c2.id, 'サービスA 年間ライセンス', 480000, 'won', '請求処理中'),
      makeSeedDeal(c2.id, 'ワークショップ実施', null, 'lead', '日程候補を 3 つ提示予定'),
      makeSeedDeal(c3.id, '新拠点向けツール導入', 1200000, 'proposal', '競合 2 社とコンペ中'),
    ];
    return { seedCustomers: [c1, c2, c3], seedDeals };
  }

  function makeSeedCustomer(company, contact, title, email, phone, memo, createdAtMs) {
    return {
      id: genId('c'), company, contact, title, email, phone, memo,
      createdAt: new Date(createdAtMs).toISOString(),
    };
  }

  function makeSeedDeal(customerId, title, amount, status, followup) {
    const iso = new Date().toISOString();
    return {
      id: genId('d'), customerId, title, amount, status, followup,
      createdAt: iso, updatedAt: iso,
    };
  }

  // ================================================
  // ビュー・モード切替
  // ================================================
  function showView(name) {
    $('view-customers').classList.toggle('hidden', name !== 'customers');
    $('view-pipeline').classList.toggle('hidden', name !== 'pipeline');
    setTabActive('btn-tab-customers', name === 'customers');
    setTabActive('btn-tab-pipeline', name === 'pipeline');
    if (name === 'pipeline') renderPipeline();
  }

  function setTabActive(id, active) {
    const el = $(id);
    el.classList.toggle('tab-active', active);
    el.classList.toggle('text-gray-500', !active);
  }

  function showMode(mode) {
    ['empty', 'detail', 'customer-form', 'deal-form'].forEach((m) => {
      $('pane-' + m).classList.toggle('hidden', m !== mode);
    });
  }

  // ================================================
  // 顧客リスト（左ペイン）
  // ================================================
  function renderCustomerList() {
    const container = $('list-customers');
    container.innerHTML = '';
    const tpl = $('tpl-customer-card');
    const filtered = filterCustomers();
    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-xs text-gray-500 py-2';
      empty.textContent = searchText ? '該当する顧客がありません' : '顧客はまだいません';
      container.appendChild(empty);
      return;
    }
    filtered.forEach((c) => container.appendChild(buildCustomerCard(c, tpl)));
  }

  function filterCustomers() {
    const sorted = [...customers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!searchText) return sorted;
    const q = searchText.toLowerCase();
    return sorted.filter((c) =>
      (c.company || '').toLowerCase().includes(q) ||
      (c.contact || '').toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q)
    );
  }

  function buildCustomerCard(c, tpl) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.customer-card-company').textContent = c.company;
    const sub = [c.contact, c.title].filter(Boolean).join(' ／ ');
    node.querySelector('.customer-card-sub').textContent = sub;
    if (c.id === selectedCustomerId) node.classList.add('customer-card-selected');
    node.addEventListener('click', () => selectCustomer(c.id));
    return node;
  }

  function selectCustomer(id) {
    selectedCustomerId = id;
    renderCustomerList();
    renderCustomerDetail();
    showMode('detail');
  }

  // ================================================
  // 顧客詳細
  // ================================================
  function renderCustomerDetail() {
    const c = customers.find((x) => x.id === selectedCustomerId);
    if (!c) { showMode('empty'); return; }
    $('detail-company').textContent = c.company;
    $('detail-contact').textContent = c.contact;
    $('detail-title').textContent = c.title ? ' ／ ' + c.title : '';
    $('detail-email').textContent = c.email || '—';
    $('detail-phone').textContent = c.phone || '—';
    $('detail-memo').textContent = c.memo || '—';
    $('detail-created').textContent = formatDateTime(c.createdAt);
    renderDealList(c.id);
  }

  function renderDealList(customerId) {
    const container = $('list-deals');
    container.innerHTML = '';
    const list = deals.filter((d) => d.customerId === customerId);
    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-sm text-gray-500 py-2';
      empty.textContent = '商談はまだありません';
      container.appendChild(empty);
      return;
    }
    const tpl = $('tpl-deal-row');
    list.forEach((d) => container.appendChild(buildDealRow(d, tpl)));
  }

  function buildDealRow(d, tpl) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const badge = node.querySelector('.deal-row-badge');
    badge.textContent = STATUS_LABEL[d.status];
    badge.className += ' ' + badgeClass(d.status);
    node.querySelector('.deal-row-title').textContent = d.title;
    node.querySelector('.deal-row-amount').textContent = formatAmount(d.amount);
    node.addEventListener('click', () => openDealForm(d.id));
    return node;
  }

  // ================================================
  // 顧客フォーム
  // ================================================
  function openCustomerForm(isEdit) {
    editingCustomerId = isEdit ? selectedCustomerId : null;
    const c = isEdit ? customers.find((x) => x.id === selectedCustomerId) : null;
    $('customer-form-title').textContent = isEdit ? '顧客を編集' : '新規顧客';
    $('input-company').value = c ? c.company : '';
    $('input-contact').value = c ? c.contact : '';
    $('input-title').value = c ? c.title : '';
    $('input-email').value = c ? c.email : '';
    $('input-phone').value = c ? c.phone : '';
    $('input-memo').value = c ? c.memo : '';
    showMode('customer-form');
    $('input-company').focus();
  }

  function onSubmitCustomer(e) {
    e.preventDefault();
    const values = readCustomerForm();
    if (!values.company || !values.contact) {
      alert('会社名と担当者名は必須です');
      return;
    }
    if (editingCustomerId) {
      const c = customers.find((x) => x.id === editingCustomerId);
      Object.assign(c, values);
    } else {
      const c = { id: genId('c'), ...values, createdAt: new Date().toISOString() };
      customers.push(c);
      selectedCustomerId = c.id;
    }
    saveCustomers();
    renderCustomerList();
    renderCustomerDetail();
    showMode('detail');
  }

  function readCustomerForm() {
    return {
      company: $('input-company').value.trim(),
      contact: $('input-contact').value.trim(),
      title: $('input-title').value.trim(),
      email: $('input-email').value.trim(),
      phone: $('input-phone').value.trim(),
      memo: $('input-memo').value,
    };
  }

  function onDeleteCustomer() {
    const c = customers.find((x) => x.id === selectedCustomerId);
    if (!c) return;
    const msg = `「${c.company}」を削除します。紐付く商談もすべて削除されます。よろしいですか？`;
    if (!confirm(msg)) return;
    // 連鎖削除: 顧客 → 商談 の順（孤児レコードを作らないため）
    customers = customers.filter((x) => x.id !== selectedCustomerId);
    saveCustomers();
    deals = deals.filter((d) => d.customerId !== selectedCustomerId);
    saveDeals();
    selectedCustomerId = null;
    renderCustomerList();
    showMode('empty');
  }

  function cancelCustomerForm() {
    if (selectedCustomerId && customers.find((x) => x.id === selectedCustomerId)) {
      renderCustomerDetail();
      showMode('detail');
    } else {
      showMode('empty');
    }
  }

  // ================================================
  // 商談フォーム
  // ================================================
  function openDealForm(dealId) {
    editingDealId = dealId || null;
    const d = dealId ? deals.find((x) => x.id === dealId) : null;
    const customerId = d ? d.customerId : selectedCustomerId;
    const c = customers.find((x) => x.id === customerId);
    selectedCustomerId = customerId;
    $('deal-form-title').textContent = d ? '商談を編集' : '新規商談';
    $('deal-form-customer').textContent = c ? c.company : '';
    $('input-deal-title').value = d ? d.title : '';
    $('input-deal-amount').value = d && d.amount != null ? d.amount : '';
    $('input-deal-status').value = d ? d.status : 'lead';
    $('input-deal-followup').value = d ? d.followup : '';
    $('btn-delete-deal').classList.toggle('hidden', !d);
    showView('customers');
    renderCustomerList();
    showMode('deal-form');
    $('input-deal-title').focus();
  }

  function onSubmitDeal(e) {
    e.preventDefault();
    const values = readDealForm();
    if (!values.title) {
      alert('タイトルは必須です');
      return;
    }
    const nowIso = new Date().toISOString();
    if (editingDealId) {
      const d = deals.find((x) => x.id === editingDealId);
      Object.assign(d, values, { updatedAt: nowIso });
    } else {
      deals.push({
        id: genId('d'), customerId: selectedCustomerId, ...values,
        createdAt: nowIso, updatedAt: nowIso,
      });
    }
    saveDeals();
    editingDealId = null;
    renderCustomerDetail();
    showMode('detail');
  }

  function readDealForm() {
    const raw = $('input-deal-amount').value.trim();
    return {
      title: $('input-deal-title').value.trim(),
      amount: raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0),
      status: $('input-deal-status').value,
      followup: $('input-deal-followup').value,
    };
  }

  function onDeleteDeal() {
    if (!editingDealId) return;
    const d = deals.find((x) => x.id === editingDealId);
    if (!d) return;
    if (!confirm(`商談「${d.title}」を削除します。よろしいですか？`)) return;
    deals = deals.filter((x) => x.id !== editingDealId);
    saveDeals();
    editingDealId = null;
    renderCustomerDetail();
    showMode('detail');
  }

  function cancelDealForm() {
    editingDealId = null;
    if (selectedCustomerId && customers.find((x) => x.id === selectedCustomerId)) {
      renderCustomerDetail();
      showMode('detail');
    } else {
      showMode('empty');
    }
  }

  // ================================================
  // パイプライン（カンバン3列）
  // ================================================
  function renderPipeline() {
    STATUS_ORDER.forEach((status, idx) => {
      const col = $('col-' + status);
      col.innerHTML = '';
      const list = deals.filter((d) => d.status === status);
      $('count-' + status).textContent = `(${list.length})`;
      const tpl = $('tpl-deal-card');
      if (list.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-xs text-gray-400 py-2 text-center';
        empty.textContent = '—';
        col.appendChild(empty);
        return;
      }
      list.forEach((d) => col.appendChild(buildPipelineCard(d, tpl, idx)));
    });
  }

  function buildPipelineCard(d, tpl, colIdx) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.classList.add('deal-card-' + d.status);
    const c = customers.find((x) => x.id === d.customerId);
    node.querySelector('.deal-card-title').textContent = d.title;
    node.querySelector('.deal-card-company').textContent = c ? c.company : '(顧客なし)';
    node.querySelector('.deal-card-amount').textContent = formatAmount(d.amount);
    wirePipelineCardActions(node, d, colIdx);
    return node;
  }

  function wirePipelineCardActions(node, d, colIdx) {
    const prev = node.querySelector('.deal-card-prev');
    const next = node.querySelector('.deal-card-next');
    if (colIdx === 0) prev.classList.add('invisible');
    if (colIdx === STATUS_ORDER.length - 1) next.classList.add('invisible');
    prev.addEventListener('click', (e) => { e.stopPropagation(); moveDealStatus(d.id, -1); });
    next.addEventListener('click', (e) => { e.stopPropagation(); moveDealStatus(d.id, 1); });
    node.addEventListener('click', () => openDealForm(d.id));
  }

  function moveDealStatus(dealId, direction) {
    const d = deals.find((x) => x.id === dealId);
    if (!d) return;
    const idx = STATUS_ORDER.indexOf(d.status);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= STATUS_ORDER.length) return;
    d.status = STATUS_ORDER[newIdx];
    d.updatedAt = new Date().toISOString();
    saveDeals();
    renderPipeline();
  }

  // ================================================
  // イベント配線
  // ================================================
  function wireEvents() {
    $('btn-tab-customers').addEventListener('click', () => showView('customers'));
    $('btn-tab-pipeline').addEventListener('click', () => showView('pipeline'));
    $('input-search').addEventListener('input', (e) => {
      searchText = e.target.value;
      renderCustomerList();
    });
    $('btn-new-customer').addEventListener('click', () => openCustomerForm(false));
    $('btn-edit-customer').addEventListener('click', () => openCustomerForm(true));
    $('btn-delete-customer').addEventListener('click', onDeleteCustomer);
    $('form-customer').addEventListener('submit', onSubmitCustomer);
    $('btn-cancel-customer').addEventListener('click', cancelCustomerForm);
    $('btn-add-deal').addEventListener('click', () => openDealForm(null));
    $('form-deal').addEventListener('submit', onSubmitDeal);
    $('btn-cancel-deal').addEventListener('click', cancelDealForm);
    $('btn-delete-deal').addEventListener('click', onDeleteDeal);
  }

  // ================================================
  // 起動
  // ================================================
  function init() {
    customers = loadCustomers();
    deals = loadDeals();
    seedIfEmpty();
    wireEvents();
    renderCustomerList();
    showView('customers');
    showMode('empty');
  }

  window.addEventListener('DOMContentLoaded', init);
})();
