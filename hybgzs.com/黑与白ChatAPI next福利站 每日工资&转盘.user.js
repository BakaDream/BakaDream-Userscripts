// ==UserScript==
// @name         黑与白ChatAPI next福利站 每日工资&转盘
// @description  黑与白chatAPI next福利站批量完成每日cdk任务
// @author       BakaDream
// @namespace    https://github.com/BakaDream/BakaDream-Userscripts
// @version      1.0
// @match        *://next-cdk.hybgzs.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @downloadURL  https://raw.githubusercontent.com/BakaDream/BakaDream-Userscripts/refs/heads/main/hybgzs.com/%E9%BB%91%E4%B8%8E%E7%99%BDChatAPI%20next%E7%A6%8F%E5%88%A9%E7%AB%99%20%E6%AF%8F%E6%97%A5%E5%B7%A5%E5%8A%A1%26%E8%BD%AC%E7%9B%98.user.js
// ==/UserScript==

(function () {
    'use strict';

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

    // 每日签到函数
    async function dailyCheckin() {
        console.log('开始执行每日签到...');
        try {
            const resp = await fetch(CHECKIN_URL, {
                method: 'POST',
                headers
            });

            if (!resp.ok) {
                const text = await resp.text();
                console.log(`签到失败，状态码 ${resp.status}，信息: ${text}`);
                return;
            }

            const data = await resp.json();
            if (data.success) {
                console.log(`签到成功！${data.data.message}`);
                console.log(`连续签到 ${data.data.consecutiveDays} 天，当前钱包余额：${data.data.walletBalance}`);
            } else {
                console.log(`签到失败：${data.error || '未知错误'}`);
            }
        } catch (err) {
            console.log(`签到请求异常：${err}`, "error");
        }
    }

    // 转盘函数
    async function spinWheel() {
        console.log('开始执行转盘任务...');
        for (let i = 1; i <= 6; i++) {
            console.log(`第 ${i} 次转盘`);
            try {
                const resp = await fetch(SPINWHEEL_URL, {
                    method: 'POST',
                    headers
                });

                if (!resp.ok) {
                    const text = await resp.text();
                    console.log(`转盘失败!状态码 ${resp.status}，信息: ${text}`);
                    break;
                }

                const data = await resp.json();
                if (data.success && data.data?.prize?.name !== "谢谢参与") {
                    console.log(`恭喜！获得奖励：${data.data.prize.name}`);
                } else {
                    console.log(data.data?.message || "很遗憾，这次没有中奖。");
                }
            } catch (err) {
                console.log(`转盘请求异常：${err}`, "error");
            }

            // 每次转盘后等待1秒，避免请求过快
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // 执行任务
    async function runTasks() {
        await dailyCheckin();
        await spinWheel();
    }

    runTasks();
})();