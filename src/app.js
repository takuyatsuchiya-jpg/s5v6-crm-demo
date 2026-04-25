import { supabase } from './supabase.js';

// ================================================
// 定数
// ================================================
const STATUS_ORDER = ['lead', 'proposal', 'won'];
const STATUS_LABEL = { lead: '見込み', proposal: '提案', won: '成約' };

// ================================================
// 状態（メモリが正、変更後は再フェッチで上書き）
// ================================================
let customers = [];
let deals = [];
let selectedCustomerId = null;
let editingCustomerId = null;
let editingDealId = null;
let searchText = '';

// ================================================
// 汎用ユーティリティ
// ================================================
const $ = (id) => document.getElementById(id);

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

function notifyError(label, error) {
  console.error(label, error);
  alert(`${label}: ${error?.message ?? '不明なエラー'}`);
}

// ================================================
// Supabase CRUD（画面コードからは直接 supabase を触らない）
// ================================================
async function fetchCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { notifyError('顧客の取得に失敗しました', error); return []; }
  return data ?? [];
}

async function fetchDeals() {
  // 商談カードに会社名を表示するため、customers を JOIN で同時取得する
  const { data, error } = await supabase
    .from('deals')
    .select('*, customers(company)')
    .order('created_at', { ascending: false });
  if (error) { notifyError('商談の取得に失敗しました', error); return []; }
  return data ?? [];
}

async function createCustomer(values) {
  const { data, error } = await supabase
    .from('customers')
    .insert(values)
    .select()
    .single();
  if (error) { notifyError('顧客の作成に失敗しました', error); return null; }
  return data;
}

async function updateCustomer(id, values) {
  const { error } = await supabase.from('customers').update(values).eq('id', id);
  if (error) { notifyError('顧客の更新に失敗しました', error); return false; }
  return true;
}

async function deleteCustomer(id) {
  // deals 側は ON DELETE CASCADE で連鎖削除される
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) { notifyError('顧客の削除に失敗しました', error); return false; }
  return true;
}

async function createDeal(values) {
  const { data, error } = await supabase
    .from('deals')
    .insert(values)
    .select()
    .single();
  if (error) { notifyError('商談の作成に失敗しました', error); return null; }
  return data;
}

async function updateDeal(id, values) {
  const { error } = await supabase.from('deals').update(values).eq('id', id);
  if (error) { notifyError('商談の更新に失敗しました', error); return false; }
  return true;
}

async function deleteDeal(id) {
  const { error } = await supabase.from('deals').delete().eq('id', id);
  if (error) { notifyError('商談の削除に失敗しました', error); return false; }
  return true;
}

async function reloadCustomers() { customers = await fetchCustomers(); }
async function reloadDeals() { deals = await fetchDeals(); }

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
  if (!searchText) return customers;
  const q = searchText.toLowerCase();
  return customers.filter((c) =>
    (c.company || '').toLowerCase().includes(q) ||
    (c.name || '').toLowerCase().includes(q) ||
    (c.title || '').toLowerCase().includes(q)
  );
}

function buildCustomerCard(c, tpl) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelector('.customer-card-company').textContent = c.company;
  const sub = [c.name, c.title].filter(Boolean).join(' ／ ');
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
  $('detail-contact').textContent = c.name;
  $('detail-title').textContent = c.title ? ' ／ ' + c.title : '';
  $('detail-email').textContent = c.email || '—';
  $('detail-phone').textContent = c.phone || '—';
  $('detail-memo').textContent = c.memo || '—';
  $('detail-created').textContent = formatDateTime(c.created_at);
  renderDealList(c.id);
}

function renderDealList(customerId) {
  const container = $('list-deals');
  container.innerHTML = '';
  const list = deals.filter((d) => d.customer_id === customerId);
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
  $('input-contact').value = c ? c.name : '';
  $('input-title').value = c ? (c.title ?? '') : '';
  $('input-email').value = c ? (c.email ?? '') : '';
  $('input-phone').value = c ? (c.phone ?? '') : '';
  $('input-memo').value = c ? (c.memo ?? '') : '';
  showMode('customer-form');
  $('input-company').focus();
}

function readCustomerForm() {
  // DB側は NOT NULL ではない列を空文字より NULL に寄せておく
  const blankToNull = (v) => (v.trim() === '' ? null : v.trim());
  return {
    company: $('input-company').value.trim(),
    name: $('input-contact').value.trim(),
    title: blankToNull($('input-title').value),
    email: blankToNull($('input-email').value),
    phone: blankToNull($('input-phone').value),
    memo: $('input-memo').value.trim() === '' ? null : $('input-memo').value,
  };
}

async function onSubmitCustomer(e) {
  e.preventDefault();
  const values = readCustomerForm();
  if (!values.company || !values.name) {
    alert('会社名と担当者名は必須です');
    return;
  }
  if (editingCustomerId) {
    const ok = await updateCustomer(editingCustomerId, values);
    if (!ok) return;
  } else {
    const created = await createCustomer(values);
    if (!created) return;
    selectedCustomerId = created.id;
  }
  await reloadCustomers();
  renderCustomerList();
  renderCustomerDetail();
  showMode('detail');
}

async function onDeleteCustomer() {
  const c = customers.find((x) => x.id === selectedCustomerId);
  if (!c) return;
  const msg = `「${c.company}」を削除します。紐付く商談もすべて削除されます。よろしいですか？`;
  if (!confirm(msg)) return;
  const ok = await deleteCustomer(selectedCustomerId);
  if (!ok) return;
  selectedCustomerId = null;
  await Promise.all([reloadCustomers(), reloadDeals()]);
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
  const customerId = d ? d.customer_id : selectedCustomerId;
  const c = customers.find((x) => x.id === customerId);
  selectedCustomerId = customerId;
  $('deal-form-title').textContent = d ? '商談を編集' : '新規商談';
  $('deal-form-customer').textContent = c ? c.company : '';
  $('input-deal-title').value = d ? d.title : '';
  $('input-deal-amount').value = d && d.amount != null ? d.amount : '';
  $('input-deal-status').value = d ? d.status : 'lead';
  $('input-deal-followup').value = d ? (d.memo ?? '') : '';
  $('btn-delete-deal').classList.toggle('hidden', !d);
  showView('customers');
  renderCustomerList();
  showMode('deal-form');
  $('input-deal-title').focus();
}

function readDealForm() {
  const raw = $('input-deal-amount').value.trim();
  const memoRaw = $('input-deal-followup').value;
  return {
    title: $('input-deal-title').value.trim(),
    amount: raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0),
    status: $('input-deal-status').value,
    memo: memoRaw.trim() === '' ? null : memoRaw,
  };
}

async function onSubmitDeal(e) {
  e.preventDefault();
  const values = readDealForm();
  if (!values.title) {
    alert('タイトルは必須です');
    return;
  }
  if (editingDealId) {
    const ok = await updateDeal(editingDealId, values);
    if (!ok) return;
  } else {
    const created = await createDeal({ ...values, customer_id: selectedCustomerId });
    if (!created) return;
  }
  editingDealId = null;
  await reloadDeals();
  renderCustomerDetail();
  showMode('detail');
}

async function onDeleteDeal() {
  if (!editingDealId) return;
  const d = deals.find((x) => x.id === editingDealId);
  if (!d) return;
  if (!confirm(`商談「${d.title}」を削除します。よろしいですか？`)) return;
  const ok = await deleteDeal(editingDealId);
  if (!ok) return;
  editingDealId = null;
  await reloadDeals();
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
  // 商談取得時の JOIN 結果（d.customers.company）を優先。フォールバックでメモリ顧客を引く。
  const company = d.customers?.company
    ?? customers.find((x) => x.id === d.customer_id)?.company
    ?? '(顧客なし)';
  node.querySelector('.deal-card-title').textContent = d.title;
  node.querySelector('.deal-card-company').textContent = company;
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

async function moveDealStatus(dealId, direction) {
  const d = deals.find((x) => x.id === dealId);
  if (!d) return;
  const idx = STATUS_ORDER.indexOf(d.status);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= STATUS_ORDER.length) return;
  const ok = await updateDeal(dealId, { status: STATUS_ORDER[newIdx] });
  if (!ok) return;
  await reloadDeals();
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
async function init() {
  wireEvents();
  showView('customers');
  showMode('empty');
  await Promise.all([reloadCustomers(), reloadDeals()]);
  renderCustomerList();
}

window.addEventListener('DOMContentLoaded', init);
