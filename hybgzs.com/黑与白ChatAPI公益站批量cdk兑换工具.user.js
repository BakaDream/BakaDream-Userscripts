// ==UserScript==
// @name         黑与白ChatAPI公益站批量cdk兑换工具
// @namespace    https://github.com/BakaDream/BakaDream-Userscripts
// @author	     BakaDream
// @version      1.1
// @description  黑与白chatAPI公益站批量兑换cdk
// @match        *://ai.hybgzs.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @downloadURL	 https://raw.githubusercontent.com/BakaDream/BakaDream-Userscripts/refs/heads/main/hybgzs.com/%E9%BB%91%E4%B8%8E%E7%99%BDChatAPI%E5%85%AC%E7%9B%8A%E7%AB%99%E6%89%B9%E9%87%8Fcdk%E5%85%91%E6%8D%A2%E5%B7%A5%E5%85%B7.js
// ==/UserScript==

(function () {
  'use strict';

  /* ================= 配置 ================= */
  const CONFIG = {
    redeemApi: 'https://ai.hybgzs.com/api/user/topup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Referer': 'https://ai.hybgzs.com/panel/topup' },
    cdkParamKey: 'key',
    retry: { enable: true, maxTimes: 2, delay: 1200 },
    requestInterval: 900,
  };

  /* ================ 样式 ================ */
  GM_addStyle(`
    .tm-float-btn {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 999999999;
      background:#2563eb;
      color:#fff;
      padding: 12px 18px;
      border-radius: 14px;
      font-size: 14px;
      cursor: grab;
      border:none;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      transition: background 0.2s;
      user-select:none;
    }
    .tm-float-btn:active { cursor: grabbing; }
    .tm-float-btn:hover { background:#1d4ed8; }

    /* modal 样式（保留你原来所有） */
    .tm-batch-btn { margin-left:10px; padding:8px 14px; border-radius:6px; border:none; cursor:pointer;
      background:#2563eb; color:#fff; font-weight:500; }
    .tm-batch-modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:999999; display:flex; align-items:center; justify-content:center; }
    .tm-batch-modal { width:540px; max-width:94%; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.15);}
    .tm-batch-header { padding:14px 16px; background:#f8fafc; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee;}
    .tm-batch-title { font-size:16px; font-weight:600; color:#111; }
    .tm-batch-close { background:none; border:none; font-size:20px; cursor:pointer; color:#666; }
    .tm-batch-body { padding:14px 16px; }
    .tm-batch-textarea { width:100%; height:160px; padding:10px; border-radius:6px; border:1px solid #e6e6e6; box-sizing:border-box; resize:vertical; font-size:13px; }
    .tm-batch-progress { margin-top:12px; font-size:13px; background:#f7fafc; padding:8px; border-radius:6px; color:#333; }
    .tm-batch-result { margin-top:10px; max-height:160px; overflow:auto; border:1px solid #f0f0f0; padding:10px; border-radius:6px; font-size:13px; background:#fff; }
    .tm-batch-result .line { margin-bottom:6px; word-break:break-word; }
    .tm-line-success { color:#059669; }
    .tm-line-fail { color:#dc2626; }
    .tm-line-info { color:#2563eb; }
    .tm-footer { padding:12px 16px; display:flex; gap:8px; justify-content:flex-end; border-top:1px solid #eee; background:#fff;}
    .tm-btn { padding:8px 14px; border-radius:6px; border:none; cursor:pointer; font-weight:500;}
    .tm-btn-primary { background:#2563eb; color:#fff;}
    .tm-btn-warning { background:#f59e0b; color:#fff;}
    .tm-btn-danger { background:#ef4444; color:#fff;}
    .tm-btn-default { background:#e5e7eb; color:#111;}
  `);

  /* ================ 状态 ================ */
  let modal = null;
  let state = {
    list: [], index: 0, succ: 0, fail: 0, running: false, paused: false, logs: []
  };

  /* ================ 工具函数 ================ */
  function safeQuery(sel, base = document) { try { return base.querySelector(sel); } catch { return null; } }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function parseCdkText(t) { return t.split(/[\n\r,，、;；\t\s]+/).map(s=>s.trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)==i); }

  function appendLog(type, text) {
    const time = new Date().toLocaleTimeString();
    const item = { time, type, text };
    state.logs.push(item);
    if (modal) {
      const panel = safeQuery('.tm-batch-result', modal);
      if (panel) {
        const div = document.createElement('div');
        div.className = `line tm-line-${type}`;
        div.textContent = `[${time}] ${text}`;
        panel.appendChild(div);
        panel.scrollTop = panel.scrollHeight;
      }
    }
  }

  function updateProgressUI() {
    if (!modal) return;
    const total = state.list.length;
    const progress = safeQuery('.tm-batch-progress', modal);
    if (progress) progress.textContent =
      `总进度：${state.index}/${total} | 成功：${state.succ} | 失败：${state.fail} | 剩余：${Math.max(0, total - state.index)}`;
  }

  /* ================ 请求 ================ */
  function sendRedeemRequest(cdk, retryTimes = 0) {
    return new Promise(resolve => {
      const payload = {}; payload[CONFIG.cdkParamKey] = cdk;

      GM_xmlhttpRequest({
        method: CONFIG.method,
        url: CONFIG.redeemApi,
        headers: CONFIG.headers,
        data: JSON.stringify(payload),
        onload: (resp) => {
          try {
            const j = JSON.parse(resp.responseText || '{}');
            if (j.success) {
              resolve({ ok: true, data: j });
            } else {
              if (CONFIG.retry.enable && retryTimes < CONFIG.retry.maxTimes) {
                appendLog('info', `${cdk} 失败：${j.message}，重试 ${retryTimes + 1}`);
                return setTimeout(() => resolve(sendRedeemRequest(cdk, retryTimes + 1)), CONFIG.retry.delay);
              }
              resolve({ ok: false, error: j.message });
            }
          } catch {
            resolve({ ok: false, error: '解析失败' });
          }
        },
        onerror: () => resolve({ ok: false, error: '网络错误' })
      });
    });
  }

  /* ================ 执行主循环 ================ */
  async function runLoop() {
    state.running = true;
    state.paused = false;

    while (state.index < state.list.length && state.running) {
      if (state.paused) { await sleep(300); continue; }

      const cdk = state.list[state.index];
      appendLog('info', `开始处理 ${cdk}`);

      const res = await sendRedeemRequest(cdk);

      if (res.ok) {
        state.succ++;
        appendLog('success', `${cdk} → 成功`);
      } else {
        state.fail++;
        appendLog('fail', `${cdk} → 失败：${res.error}`);
      }

      state.index++;
      updateProgressUI();
      await sleep(CONFIG.requestInterval);
    }

    appendLog('info', `任务结束：成功 ${state.succ}, 失败 ${state.fail}`);
    state.running = false;
  }

  /* ================ UI 控制 ================ */
  function startFromUI() {
    const ta = safeQuery('.tm-batch-textarea', modal);
    if (!ta) return;
    const arr = parseCdkText(ta.value);
    if (!arr.length) return appendLog('fail', '没有有效 CDK');

    state.list = arr;
    state.index = 0;
    state.succ = 0;
    state.fail = 0;
    state.logs = [];

    const panel = safeQuery('.tm-batch-result', modal);
    if (panel) panel.innerHTML = '';

    appendLog('info', `解析到 ${arr.length} 个 CDK，开始`);
    runLoop();
  }
  function pauseFromUI() { state.paused = true; appendLog('info', '已暂停'); }
  function resumeFromUI() { state.paused = false; appendLog('info', '继续运行'); }
  function resetFromUI() {
    if (state.running) return appendLog('fail', '请先暂停');
    state = { list: [], index: 0, succ: 0, fail: 0, running: false, paused: false, logs: [] };
    const panel = safeQuery('.tm-batch-result', modal);
    if (panel) panel.innerHTML = '';
  }
  function exportLogsToFile() {
    const lines = state.logs.map(l => `[${l.time}] ${l.type} ${l.text}`).join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `redeem_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ================ 构建 Modal ================ */
  function buildModal() {
    if (modal) return modal;

    const backdrop = document.createElement('div');
    backdrop.className = 'tm-batch-modal-backdrop';

    backdrop.innerHTML = `
      <div class="tm-batch-modal">
        <div class="tm-batch-header">
          <div class="tm-batch-title">批量兑换</div>
          <button class="tm-batch-close">&times;</button>
        </div>
        <div class="tm-batch-body">
          <textarea class="tm-batch-textarea"></textarea>
          <div class="tm-batch-progress">总进度：0/0 | 成功：0 | 失败：0 | 剩余：0</div>
          <div class="tm-batch-result"></div>
        </div>
        <div class="tm-footer">
          <button class="tm-btn tm-btn-default tm-export">导出日志</button>
          <button class="tm-btn tm-btn-default tm-reset">重置</button>
          <button class="tm-btn tm-btn-warning tm-pause">暂停</button>
          <button class="tm-btn tm-btn-primary tm-start">开始</button>
        </div>
      </div>`;

    modal = backdrop;

    safeQuery('.tm-batch-close', backdrop).onclick = () => { backdrop.remove(); modal = null; };
    safeQuery('.tm-start', backdrop).onclick = () => state.paused ? resumeFromUI() : startFromUI();
    safeQuery('.tm-pause', backdrop).onclick = () => pauseFromUI();
    safeQuery('.tm-reset', backdrop).onclick = () => resetFromUI();
    safeQuery('.tm-export', backdrop).onclick = () => exportLogsToFile();

    return modal;
  }

  /* ================ 可拖拽悬浮按钮 ================ */
  function injectFloatButton() {
    if (document.querySelector('.tm-float-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'tm-float-btn';
    btn.textContent = '批量兑换';

    // 拖拽事件
    let offsetX = 0, offsetY = 0, dragging = false;

    btn.addEventListener('mousedown', (e) => {
      dragging = true;
      offsetX = e.clientX - btn.offsetLeft;
      offsetY = e.clientY - btn.offsetTop;
      btn.style.transition = "none";
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      btn.style.left = (e.clientX - offsetX) + 'px';
      btn.style.top = (e.clientY - offsetY) + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
      btn.style.position = 'fixed';
    });

    document.addEventListener('mouseup', () => {
      dragging = false;
      btn.style.transition = "background 0.2s";
    });

    btn.onclick = () => {
      if (dragging) return; // 防止拖拽误触
      const m = buildModal();
      if (!document.body.contains(m)) document.body.appendChild(m);
      updateProgressUI();
    };

    document.body.appendChild(btn);
  }

  /* ================ 启动 ================ */
  injectFloatButton();

})();
