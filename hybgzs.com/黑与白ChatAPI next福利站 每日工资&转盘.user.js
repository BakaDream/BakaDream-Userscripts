// ==UserScript==
// @name         黑与白ChatAPI next福利站 每日工资&转盘
// @description  黑与白chatAPI next福利站批量完成每日cdk任务
// @author       BakaDream
// @namespace    https://github.com/BakaDream/BakaDream-Userscripts
// @version      1.1
// @match        *://next-cdk.hybgzs.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @downloadURL  https://raw.githubusercontent.com/BakaDream/BakaDream-Userscripts/refs/heads/main/hybgzs.com/%E9%BB%91%E4%B8%8E%E7%99%BDChatAPI%20next%E7%A6%8F%E5%88%A9%E7%AB%99%20%E6%AF%8F%E6%97%A5%E5%B7%A5%E5%8A%A1%26%E8%BD%AC%E7%9B%98.user.js
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
    .hy-title{ color: #000; font-size:16px; font-weight:600; }
    .hy-close{
      background:none; border:none; cursor:pointer;
      font-size:22px; color:#555;
    }

    .hy-body{ padding:14px 16px; }

    .hy-log-box {
      max-height: 300px;
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
      margin-bottom: 12px;
    }

    .hy-log-info { color: #2563eb; }    /* 蓝色：信息 */
    .hy-log-success { color: #059669; }/* 绿色：成功 */
    .hy-log-warn { color: #f59e0b; }   /* 黄色：警告 */
    .hy-log-error { color: #dc2626; }  /* 红色：错误 */

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
  `);

    /* ==================== 状态 & 配置 ==================== */
    let modal = null;
    let running = false;
    let debugLogs = [];

    // API配置
    const BASE_URL = 'https://next-cdk.hybgzs.com/';
    const SPINWHEEL_URL = BASE_URL + 'api/wheel';
    const CHECKIN_URL = BASE_URL + 'api/checkin';

    const headers = {
        'accept': '*/*',
        'content-type': 'application/json',
        'origin': 'https://next-cdk.hybgzs.com/',
        'referer': window.location.href,
        'cookie': document.cookie
    };

    /* ==================== 日志函数（双输出：控制台+浮窗） ==================== */
    function log(msg, type = "info") {
        // 1. 控制台输出（带颜色）
        const consoleColors = {
            info: '\x1B[34m',    // 蓝色
            success: '\x1B[32m', // 绿色
            warn: '\x1B[33m',    // 黄色
            error: '\x1B[31m',   // 红色
            reset: '\x1B[0m'     // 重置颜色
        };
        console.log(`${consoleColors[type]}[${new Date().toLocaleTimeString()}] ${msg}${consoleColors.reset}`);

        // 2. 浮窗日志存储
        const time = new Date().toLocaleTimeString();
        const finalMsg = `[${time}] ${msg}`;
        debugLogs.push(finalMsg);

        // 3. 浮窗UI更新
        if (modal) {
            const box = modal.querySelector('.hy-log-box');
            const div = document.createElement("div");
            div.textContent = finalMsg;
            div.className = `hy-log-${type}`;
            box.appendChild(div);
            box.scrollTop = box.scrollHeight; // 自动滚动到底部
        }
    }

    /* ==================== 核心任务函数 ==================== */
    // 每日签到
    async function dailyCheckin() {
        log('开始执行每日签到...', 'info');
        try {
            const resp = await fetch(CHECKIN_URL, { method: 'POST', headers });

            if (!resp.ok) {
                const text = await resp.text();
                log(`签到失败，状态码 ${resp.status}，信息: ${text}`, 'error');
                return;
            }

            const data = await resp.json();
            if (data.success) {
                log(`签到成功！${data.data.message}`, 'success');
                log(`连续签到 ${data.data.consecutiveDays} 天，当前钱包余额：${data.data.walletBalance}`, 'info');
            } else {
                log(`签到失败：${data.error || '未知错误'}`, 'warn');
            }
        } catch (err) {
            log(`签到请求异常：${err}`, 'error');
        }
    }

    // 转盘任务
    async function spinWheel() {
        log('开始执行转盘任务...', 'info');
        for (let i = 1; i <= 6; i++) {
            if (!running) {
                log(`转盘任务已停止（当前为第 ${i} 次，未完成）`, 'warn');
                break;
            }

            log(`第 ${i} 次转盘`, 'info');
            try {
                const resp = await fetch(SPINWHEEL_URL, { method: 'POST', headers });

                if (!resp.ok) {
                    const text = await resp.text();
                    log(`转盘失败!状态码 ${resp.status}，信息: ${text}`, 'error');
                    break;
                }

                const data = await resp.json();
                if (data.success && data.data?.prize?.name !== "谢谢参与") {
                    log(`恭喜！获得奖励：${data.data.prize.name}`, 'success');
                } else {
                    log(data.data?.message || "很遗憾，这次没有中奖。", 'info');
                }
            } catch (err) {
                log(`转盘请求异常：${err}`, 'error');
            }

            // 每次转盘后等待1秒，避免请求过快
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        log('转盘任务执行完毕', 'info');
    }

    /* ==================== 任务控制 ==================== */
    async function runTasks() {
        if (running) return;
        running = true;

        // 初始化日志框
        if (modal) {
            const box = modal.querySelector('.hy-log-box');
            box.innerHTML = ''; // 清空历史日志
            debugLogs = [];
        }

        log('任务开始执行！', 'success');
        await dailyCheckin();
        if (running) await spinWheel(); // 若未停止，继续执行转盘
        log('所有任务执行完毕！', 'success');

        running = false;
    }

    function stopTasks() {
        running = false;
        log('任务已手动停止！', 'warn');
    }

    /* ==================== 浮窗UI构建 ==================== */
    function buildDialog() {
        if (modal) return modal;

        const backdrop = document.createElement("div");
        backdrop.className = "hy-dialog-backdrop";

        backdrop.innerHTML = `
      <div class="hy-dialog">
        <div class="hy-header">
          <div class="hy-title">任务控制台</div>
          <button class="hy-close">&times;</button>
        </div>
        <div class="hy-body">
          <div class="hy-log-box"></div>
        </div>
        <div class="hy-footer">
          <button class="hy-btn-sm hy-btn-start">开始任务</button>
          <button class="hy-btn-sm hy-btn-stop">停止任务</button>
        </div>
      </div>
    `;

        modal = backdrop;

        // 绑定事件
        backdrop.querySelector(".hy-close").onclick = () => {
            modal.remove();
            modal = null;
        };
        backdrop.querySelector(".hy-btn-start").onclick = runTasks;
        backdrop.querySelector(".hy-btn-stop").onclick = stopTasks;

        return backdrop;
    }

    /* ==================== 悬浮按钮 ==================== */
    function injectButton() {
        const btn = document.createElement("button");
        btn.className = "hy-btn";
        btn.textContent = "自动任务";

        let dragging = false;
        let offsetX = 0, offsetY = 0;

        // 拖拽功能
        btn.addEventListener("mousedown", (e) => {
            dragging = true;
            offsetX = e.clientX - btn.offsetLeft;
            offsetY = e.clientY - btn.offsetTop;
            btn.style.transition = "none";
        });
        document.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            btn.style.left = `${e.clientX - offsetX}px`;
            btn.style.top = `${e.clientY - offsetY}px`;
            btn.style.right = "auto";
            btn.style.bottom = "auto";
        });
        document.addEventListener("mouseup", () => {
            dragging = false;
            btn.style.transition = "";
        });

        // 点击打开浮窗
        btn.onclick = () => {
            if (dragging) return;
            const d = buildDialog();
            if (!document.body.contains(d)) document.body.appendChild(d);
        };

        document.body.appendChild(btn);
    }

    // 初始化：注入悬浮按钮
    injectButton();
})();