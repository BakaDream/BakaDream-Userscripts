// ==UserScript==
// @name         黑与白ChatAPI福利站 自动工资领取 & 转盘
// @description  黑与白chatAPI福利站批量完成每日cdk任务
// @author	     BakaDream
// @namespace    https://github.com/BakaDream/BakaDream-Userscripts
// @version      1.0
// @match        *://cdk.hybgzs.com/*
// @grant        GM_addStyle
// @downloadURL  https://raw.githubusercontent.com/BakaDream/BakaDream-Userscripts/refs/heads/main/hybgzs.com/黑与白ChatAPI福利站%20自动工资领取%20%26%20转盘.js
// ==/UserScript==

(function () {
  'use strict';

  /* ==================== 样式 ==================== */
  GM_addStyle(`
    .hy-btn {
      position: fixed;
      right: 22px; bottom: 22px;
      z-index: 999999999;
      background:#2563eb; color:#fff;
      padding: 12px 18px; border-radius: 14px;
      font-size: 14px; cursor: grab;
      user-select:none;
      border:none;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
    }
    .hy-btn:hover { background:#1d4ed8; }

    .hy-dialog-backdrop {
      position:fixed; inset:0;
      background:rgba(0,0,0,0.45);
      display:flex; justify-content:center; align-items:center;
      z-index:99999999;
    }

    .hy-dialog {
      width:560px; max-width:95%;
      background:white; border-radius:12px;
      box-shadow:0 8px 30px rgba(0,0,0,0.25);
      overflow:hidden;
      font-size:14px;
    }

    .hy-header{
      padding:12px 16px;
      background:#f8fafc;
      border-bottom:1px solid #eee;
      display:flex; justify-content:space-between;
    }
    .hy-title{ font-size:16px; font-weight:600; }
    .hy-close{
      background:none; border:none; cursor:pointer;
      font-size:22px; color:#555;
    }

    .hy-body{ padding:14px 16px; }

    .hy-cdk-textarea{
      width:100%;
      height:130px;
      padding:8px;
      font-size:13px;
      border-radius:6px;
      border:1px solid #fb923c;
      background:#fff7ed;
      resize:vertical;
      margin-bottom:12px;
      box-sizing:border-box;
      white-space: pre-wrap;
    }

    .hy-log-box {
      max-height: 260px;
      overflow: auto;
      background: #fff;
      border: 1px solid #f0f0f0;
      padding: 10px;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.45;
      color: #333;
      box-sizing: border-box;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: Consolas, monospace;
    }

    .hy-log-info {
      color: #2563eb;   /* 蓝色：info */
    }
    .hy-log-success {
      color: #059669;   /* 绿色：成功 */
    }
    .hy-log-warn {
      color: #f59e0b;   /* 黄色：警告 */
    }
    .hy-log-error {
      color: #dc2626;   /* 红色：错误 */
    }

    .hy-footer{
      padding:12px 16px;
      border-top:1px solid #eee;
      display:flex; gap:10px;
      justify-content:flex-end;
      align-items:center;
    }
    .hy-btn-sm{
      padding:8px 14px; border:none; border-radius:6px;
      cursor:pointer; font-weight:500;
    }
    .hy-btn-start{ background:#2563eb; color:white; }
    .hy-btn-stop{ background:#dc2626; color:white; }
    .hy-btn-copy{ background:#10b981; color:white; }
  `);

  /* ==================== 状态 ==================== */
  let modal = null;
  let running = false;
  let debugLogs = [];
  let allCdks = [];

  const page_version = window.pageVersion || "vab03ed43";
  const headers = {
    'accept': '*/*',
    'content-type': 'application/json',
    'origin': 'https://cdk.hybgzs.com',
    'referer': window.location.href,
    'cookie': document.cookie
  };

  /* ==================== 日志函数（带颜色） ==================== */
  function log(msg, type = "info") {
    const time = new Date().toLocaleTimeString();
    const final = `[${time}] ${msg}`;

    debugLogs.push(final);

    if (modal) {
      const box = modal.querySelector('.hy-log-box');

      const div = document.createElement("div");
      div.textContent = final;
      div.className = "hy-log-" + type;
      box.appendChild(div);

      box.scrollTop = box.scrollHeight;
    }
  }

  /* ==================== 更新 CDK 输入框 ==================== */
  function refreshCdkUI() {
    if (!modal) return;
    const txt = modal.querySelector('.hy-cdk-textarea');
    txt.value = allCdks.join("\n");
  }

  function safeJSON(str) {
    try { return JSON.parse(str); }
    catch { return { parse_error: true, raw: str }; }
  }

  /* ==================== API 调用 ==================== */
  async function claimWage() {
    log(`开始领取工资`);
    try {
      const resp = await fetch('https://cdk.hybgzs.com/api/claim-wage.php', {
        method: 'POST',
        headers,
        body: JSON.stringify({ page_version })
      });
      const text = await resp.text();
      const data = safeJSON(text);

      log(`工资领取结果：${JSON.stringify(data)}`, data.error ? "error" : "success");

      if (data.cdk) {
        allCdks.push(data.cdk);
        refreshCdkUI();
      }

    } catch (err) {
      log(`领取工资时发生异常：${err}`, "error");
    }
  }

  async function spinWheel() {
    for (let i = 1; i <= 6; i++) {
      if (!running) break;

      log(`第 ${i} 次转盘`);

      try {
        const resp = await fetch('https://cdk.hybgzs.com/api/spin-wheel.php', {
          method: 'POST',
          headers,
          body: JSON.stringify({ page_version })
        });
        const text = await resp.text();
        const data = safeJSON(text);

        log(`转盘结果：${JSON.stringify(data)}`, data.error ? "error" : "success");

        if (data.cdk) {
          allCdks.push(data.cdk);
          refreshCdkUI();
        }

        if (data.remaining_spins === 0) {
          log("剩余次数为 0，提前结束。", "warn");
          break;
        }

      } catch (err) {
        log(`转盘错误：${err}`, "error");
      }
    }
  }

  /* ==================== 主任务控制 ==================== */
  async function runTasks() {
    running = true;
    debugLogs = [];
    allCdks = [];
    refreshCdkUI();

    log("任务开始！", "success");
    await claimWage();

    if (!running) return;
    await spinWheel();

    log("全部任务执行完毕！", "success");
    running = false;
  }

  function stopTasks() {
    running = false;
    log("任务已停止！", "warn");
  }

  /* ==================== 构建 Dialog ==================== */
  function buildDialog() {
    if (modal) return modal;

    const backdrop = document.createElement("div");
    backdrop.className = "hy-dialog-backdrop";

    backdrop.innerHTML = `
      <div class="hy-dialog">
        <div class="hy-header">
          <div class="hy-title">自动任务工具</div>
          <button class="hy-close">&times;</button>
        </div>

        <div class="hy-body">

          <!-- ★★ 修改点：CDK 文本域替换原盒子 ★★ -->
          <textarea class="hy-cdk-textarea" placeholder="这里将显示所有 CDK"></textarea>

          <!-- ★★ 修改点：复制按钮与开始/停止放同一行 ★★ -->
          <div style="display:flex; gap:10px; margin-bottom:10px;">
            <button class="hy-btn-sm hy-btn-copy">复制 CDK</button>
            <button class="hy-btn-sm hy-btn-start">开始</button>
            <button class="hy-btn-sm hy-btn-stop">停止</button>
          </div>

          <div class="hy-log-box"></div>
        </div>
      </div>
    `;

    modal = backdrop;

    backdrop.querySelector(".hy-close").onclick = () => {
      modal.remove();
      modal = null;
    };

    backdrop.querySelector(".hy-btn-start").onclick = () => {
      if (!running) runTasks();
    };

    backdrop.querySelector(".hy-btn-stop").onclick = stopTasks;

    backdrop.querySelector(".hy-btn-copy").onclick = () => {
      navigator.clipboard.writeText(allCdks.join("\n") || "");
      log("CDK 已复制到剪贴板！", "success");
    };

    return backdrop;
  }

  /* ==================== 悬浮按钮 ==================== */
  function injectButton() {
    const btn = document.createElement("button");
    btn.className = "hy-btn";
    btn.textContent = "自动任务";

    let dragging = false;
    let offsetX = 0, offsetY = 0;

    btn.addEventListener("mousedown", (e) => {
      dragging = true;
      offsetX = e.clientX - btn.offsetLeft;
      offsetY = e.clientY - btn.offsetTop;
      btn.style.transition = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      btn.style.left = (e.clientX - offsetX) + "px";
      btn.style.top = (e.clientY - offsetY) + "px";
      btn.style.right = "auto";
      btn.style.bottom = "auto";
      btn.style.position = "fixed";
    });

    document.addEventListener("mouseup", () => {
      dragging = false;
      btn.style.transition = "";
    });

    btn.onclick = () => {
      if (dragging) return;
      const d = buildDialog();
      if (!document.body.contains(d)) document.body.appendChild(d);
    };

    document.body.appendChild(btn);
  }

  injectButton();
})();
