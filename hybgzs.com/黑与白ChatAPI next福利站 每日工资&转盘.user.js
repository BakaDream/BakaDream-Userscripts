// ==UserScript==
// @name         黑与白ChatAPI next福利站 每日工资&转盘
// @description  黑与白chatAPI next福利站批量完成每日cdk任务
// @author       BakaDream
// @namespace    https://github.com/BakaDream/BakaDream-Userscripts
// @version      1.3
// @match        *://next-cdk.hybgzs.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @downloadURL  https://raw.githubusercontent.com/BakaDream/BakaDream-Userscripts/refs/heads/main/hybgzs.com/%E9%BB%91%E4%B8%8E%E7%99%BDChatAPI%20next%E7%A6%8F%E5%88%A9%E7%AB%99%20%E6%AF%8F%E6%97%A5%E5%B7%A5%E8%B5%84%26%E8%BD%AC%E7%9B%98.user.js
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
      display: flex; flex-direction: column; /* 确保内容可滚动 */
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
      max-height: 200px; /* 调整高度以适应 Turnstile */
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

    /* Turnstile 容器样式 */
    #hy-turnstile-container {
        min-height: 0px;
        transition: all 0.3s;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 10px;
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
    .hy-btn-disabled { background:#94a3b8; cursor: not-allowed; }
  `);

    /* ==================== 状态 & 配置 ==================== */
    let modal = null;
    let running = false;
    let debugLogs = [];
    let turnstileWidgetId = null; // Turnstile 状态

    // API配置
    const BASE_URL = 'https://next-cdk.hybgzs.com/';
    const SPINWHEEL_URL = BASE_URL + 'api/wheel';
    const CHECKIN_URL = BASE_URL + 'api/checkin';
    const SITE_KEY = '0x4AAAAAABviDoYkzB9uGu4N'; //Turnstile Site Key
    const STATUS_URL = BASE_URL + 'api/cards/draw/status';
    const DRAW_URL = BASE_URL + 'api/cards/draw';

    const headers = {
        'accept': '*/*',
        'content-type': 'application/json',
        'origin': 'https://next-cdk.hybgzs.com/',
        'referer': window.location.href,
        'cookie': document.cookie
    };

    /* ==================== 日志函数 ==================== */
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
            if(box) {
                const div = document.createElement("div");
                div.textContent = finalMsg;
                div.className = `hy-log-${type}`;
                box.appendChild(div);
                box.scrollTop = box.scrollHeight; // 自动滚动到底部
            }
        }
    }

    /* ==================== 自动注入 Turnstile  ==================== */

    // 检查并加载 Cloudflare 脚本
    async function loadTurnstileLib() {
        if (unsafeWindow.turnstile) return true;

        log('正在加载 Cloudflare Turnstile 验证组件...', 'warn');
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                // 脚本加载后，可能需要一点点时间初始化
                setTimeout(() => {
                    if(unsafeWindow.turnstile) {
                        resolve(true);
                    } else {
                        log('脚本加载完成但对象未就绪，请重试', 'error');
                        resolve(false);
                    }
                }, 1000);
            };
            script.onerror = () => {
                log('无法连接 Cloudflare，请检查网络', 'error');
                resolve(false);
            };
            document.head.appendChild(script);
        });
    }


    // 每日签到
    async function dailyCheckin(token) {
        log('开始执行每日签到...', 'info');
        try {
            const resp = await fetch(CHECKIN_URL, {
                method: 'POST',
                headers: headers,
                // 签到请求体现在需要包含 turnstileToken
                body: JSON.stringify({ turnstileToken: token })
            });

            // 统一处理 API 返回，包括纯文本错误
            const text = await resp.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch(e) {
                // 如果不是 JSON，说明服务器报错了
                log(`签到异常: ${text.slice(0, 50)}...`, 'error');
                return;
            }

            if (!resp.ok) {
                log(`签到失败: ${data.error || '未知错误'}`, 'error');
                return;
            }

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
  // 获取抽卡状态
    async function getDrawStatus() {
        log('正在获取抽卡状态...', 'info');
        try {
            const resp = await fetch(STATUS_URL, { headers });
            const data = await resp.json();

            if (data.success && data.limits) {
                log(`状态获取成功。免费剩余: ${data.limits.freeRemaining} 次。`, 'success');
                return data.limits;
            } else {
                log(`获取状态失败: ${data.error || '数据不完整'}`, 'error');
                return null;
            }
        } catch (err) {
            log(`获取状态请求异常：${err}`, 'error');
            return null;
        }
    }

    // 执行抽卡
    async function executeDraw(type) {
        if (!running) return { success: false, message: "任务已停止" };

        const drawType = type === 10 ? "ten" : "single";
        log(`开始执行 ${type} 连抽 (${drawType})...`, 'info');

        try {
            const resp = await fetch(DRAW_URL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ type: drawType })
            });

            const data = await resp.json();
            if (resp.ok && data.success) {
                const totalCards = data.cards.length;
                const legendaryCount = data.cards.filter(c => c.rarity === 'legendary').length;
                const epicCount = data.cards.filter(c => c.rarity === 'epic').length;

                let msg = `${type} 连抽成功！获得 ${totalCards} 张卡片。`;
                if (legendaryCount > 0) msg += ` 👑 传说卡: ${legendaryCount} 张。`;
                if (epicCount > 0) msg += ` 🌟 史诗卡: ${epicCount} 张。`;

                log(msg, 'success');
                return { success: true, count: type };
            } else {
                log(`抽卡失败: ${data.error || '未知错误'}`, 'warn');
                return { success: false, message: data.error || '未知错误' };
            }
        } catch (err) {
            log(`抽卡请求异常：${err}`, 'error');
            return { success: false, message: err.toString() };
        }
    }

    // 自动抽卡主逻辑
    async function autoDrawFreeCards() {
        let drawCount = 0;
        let status = await getDrawStatus();

        if (!status || status.freeRemaining === 0) {
            log('免费抽卡次数为 0，跳过自动抽卡。', 'info');
            return;
        }

        let remaining = status.freeRemaining;
        log(`开始执行免费抽卡，剩余 ${remaining} 次...`, 'info');

        // 1. 优先执行十连抽
        while (running && remaining >= 10) {
            const result = await executeDraw(10);
            if (result.success) {
                remaining -= 10;
                drawCount += 10;
                await new Promise(resolve => setTimeout(resolve, 2000)); // 间隔2秒
            } else {
                log(`十连抽中断: ${result.message}`, 'error');
                running = false; // 如果十连抽失败，则停止
                break;
            }
        }

        // 2. 执行剩余的单抽
        while (running && remaining > 0) {
            const result = await executeDraw(1);
            if (result.success) {
                remaining -= 1;
                drawCount += 1;
                await new Promise(resolve => setTimeout(resolve, 1000)); // 间隔1秒
            } else {
                log(`单抽中断: ${result.message}`, 'error');
                running = false; // 如果单抽失败，则停止
                break;
            }
        }

        log(`免费抽卡任务执行完毕！共计抽卡 ${drawCount} 次。`, 'success');
    }

    // 验证通过后执行任务
    async function executeTasksAfterVerify(token) {
        if (!running) return;
        await dailyCheckin(token);
        if (running) await spinWheel();
      if (running) await autoDrawFreeCards();
        log('所有任务执行完毕！', 'success');
        running = false;
        updateBtnState();
    }

    // 渲染 Turnstile 验证码
    async function renderTurnstile() {
        const container = document.getElementById('hy-turnstile-container');
        if (!container) return;

        // 1. 确保环境就绪
        const ready = await loadTurnstileLib();
        if (!ready) {
            log('错误：Cloudflare 环境加载失败，请刷新页面重试', 'error');
            running = false;
            updateBtnState();
            return;
        }

        // 2. 清理旧的
        if (turnstileWidgetId !== null) {
            try { unsafeWindow.turnstile.remove(turnstileWidgetId); } catch(e) {}
            turnstileWidgetId = null;
        }

        container.innerHTML = '';
        container.style.minHeight = '65px';

        log('环境就绪，请手动点击验证...', 'warn');

        try {
            turnstileWidgetId = unsafeWindow.turnstile.render(container, {
                sitekey: SITE_KEY,
                theme: 'light',
                callback: async function(token) {
                    log('✅ 验证通过！正在请求任务...', 'success');
                    container.style.minHeight = '0px';
                    container.innerHTML = ''; // 隐藏验证码
                    await executeTasksAfterVerify(token);
                },
                'error-callback': function() {
                    log('验证出错，请重试', 'error');
                },
                'expired-callback': function() {
                    log('验证过期，请刷新重试', 'warn');
                    running = false; // 验证过期，终止任务
                    updateBtnState();
                }
            });
        } catch (e) {
            log('验证码渲染失败: ' + e.message, 'error');
            running = false;
            updateBtnState();
        }
    }


    /* ==================== UI 交互  ==================== */
    async function startTasks() {
        if (running) return;
        running = true;
        updateBtnState();

        // 初始化日志框
        if (modal) {
            const box = modal.querySelector('.hy-log-box');
            box.innerHTML = '';
            debugLogs = [];
        }

        log('任务开始执行，等待 Cloudflare 验证...', 'success');
        // 启动任务的入口现在是渲染 Turnstile
        renderTurnstile();
    }

    function stopTasks() {
        running = false;
        log('任务已手动停止！', 'warn');
        // 尝试移除 Turnstile 验证码
        if (turnstileWidgetId !== null) {
            try { unsafeWindow.turnstile.remove(turnstileWidgetId); } catch(e) {}
            turnstileWidgetId = null;
            const container = document.getElementById('hy-turnstile-container');
            if (container) {
                container.innerHTML = '';
                container.style.minHeight = '0px';
            }
        }
        updateBtnState();
    }

    function updateBtnState() {
        if(!modal) return;
        const startBtn = modal.querySelector('.hy-btn-start');
        const stopBtn = modal.querySelector('.hy-btn-stop');
        if(running) {
            startBtn.classList.add('hy-btn-disabled');
            startBtn.textContent = "运行中...";
            stopBtn.disabled = false;
        } else {
            startBtn.classList.remove('hy-btn-disabled');
            startBtn.textContent = "开始任务";
            stopBtn.disabled = true;
        }
    }

    /* ==================== 浮窗UI构建 ==================== */
    function buildDialog() {
        if (modal) return modal;

        const backdrop = document.createElement("div");
        backdrop.className = "hy-dialog-backdrop";

        backdrop.innerHTML = `
      <div class="hy-dialog">
        <div class="hy-header">
          <div class="hy-title">任务控制台 </div>
          <button class="hy-close">&times;</button>
        </div>
        <div class="hy-body">
          <div class="hy-log-box"></div>
          <div id="hy-turnstile-container"></div> </div>
        <div class="hy-footer">
          <button class="hy-btn-sm hy-btn-start">开始任务</button>
          <button class="hy-btn-sm hy-btn-stop">停止任务</button>
        </div>
      </div>
    `;

        modal = backdrop;

        // 绑定事件
        backdrop.querySelector(".hy-close").onclick = () => {
            stopTasks(); // 关闭对话框时应停止所有任务
            modal.remove();
            modal = null;
        };
        backdrop.querySelector(".hy-btn-start").onclick = startTasks;
        backdrop.querySelector(".hy-btn-stop").onclick = stopTasks;

        updateBtnState(); // 初始化按钮状态
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