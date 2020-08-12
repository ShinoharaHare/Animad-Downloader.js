// ==UserScript==
// @name         動畫瘋-影片下載器(開發用)
// @namespace    https://shinoharahare.github.io/
// @version      develop
// @description  直接在瀏覽器上下載動畫瘋影片
// @author       Hare
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @grant        GM.addStyle
// @grant        GM.getResourceText
// @grant        GM.getResourceUrl
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @resource     vuetify.scoped.css http://127.0.0.1:5500/public/vuetify.scoped.css
// @require      https://cdn.jsdelivr.net/npm/vue@2.x/dist/vue.js
// @require      https://cdn.jsdelivr.net/npm/vuetify@2.x/dist/vuetify.js
// @require      https://unpkg.com/m3u8-parser@4.4.0/dist/m3u8-parser.min.js
// @require      http://127.0.0.1:5500/public/ffmpeg.js
// @connect      gamer-cds.cdn.hinet.net
// @connect      127.0.0.1

// ==/UserScript==

(async () => {
    'use strict';
    updateConfig()

    GM.addStyle(await GM.getResourceText('vuetify.scoped.css'))
    GM.addStyle(`
            #app .v-main__wrap * { pointer-events: all; }
            #app .dragable {
                cursor: grab;
                user-select: none;
                -moz-user-select: none;
                -khtml-user-select: none;
                -webkit-user-select: none;
                -o-user-select: none;
            }
            #app .dragable:active { cursor: grabbing; }
    `)

    addStyle('https://cdn.jsdelivr.net/npm/@mdi/font@5.x/css/materialdesignicons.min.css')
    addStyle('https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900')
    addStyle('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@100;300;400;500;700;900&display=swap')

    $('.top_sky').css('z-index', '11')

    let container = $(document.createElement('div')).appendTo('body')
    container.css({
        height: '100vh',
        width: '100vw',
        position: 'fixed',
        'z-index': 12,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        'pointer-events': 'none'
    })

    container.html(await get('http://127.0.0.1:5500/develop/container.html'))
    eval(await get('http://127.0.0.1:5500/develop/container.js'))
})();


async function getSrc() {
    await wait(() => videojs)
    const player = await wait(() => videojs.getPlayer('ani_video'))
    const src = await wait(() => {
        let src = player.src()
        if (src.includes('gamer_ad')) {
            return false
        } else {
            return src
        }
    }, 0, 1000)
    return src
}


function parseM3U8(m3u8) {
    let parser = new m3u8Parser.Parser()
    parser.push(m3u8)
    parser.end()
    return parser.manifest
}


function basename(url) {
    return url.split('/').pop().split('#')[0].split('?')[0]
}


function resolve(url1, url2) {
    return new URL(url2, url1).href
}


function str2ab(str) {
    let buf = new ArrayBuffer(str.length)
    let bufView = new Uint8Array(buf)
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i)
    }
    return buf
}


function triggerDownload(url, name) {
    let a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
}


async function updateConfig() {
    const version = await GM.getValue('version', null)
    if (version != GM.info.script.version) {
        GM.setValue('version', GM.info.script.version)
    }
}


async function get(url, responseType = 'text') {
    const { response } = await GM.xmlHttpRequest({
        method: 'GET',
        url: url,
        headers: { 'Origin': 'https://ani.gamer.com.tw' },
        responseType: responseType
    })
    return response
}


function wait(tester, timeout, delay = 100) {
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            const result = tester()
            if (result) {
                clearInterval(interval)
                resolve(result)
            }
        }, delay)
        if (timeout) {
            setTimeout(() => {
                clearInterval(interval)
                reject()
            }, timeout)
        }
    })
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}


function addStyle(url) {
    $('head').append(`<link href="${url}" rel="stylesheet">`)
}


; (() => {
    const d = {};
    document.addEventListener("mousedown", e => {
        const closestDialog = e.target.closest(".v-dialog.v-dialog--active");
        if (e.button === 0 && closestDialog != null && e.target.classList.contains("dragable")) { // element which can be used to move element
            d.el = closestDialog; // element which should be moved
            d.mouseStartX = e.clientX;
            d.mouseStartY = e.clientY;
            d.elStartX = d.el.getBoundingClientRect().left;
            d.elStartY = d.el.getBoundingClientRect().top;
            d.el.style.position = "fixed";
            d.el.style.margin = 0;
            d.oldTransition = d.el.style.transition;
            d.el.style.transition = "none"
        }
    });
    document.addEventListener("mousemove", e => {
        if (d.el === undefined) return;
        d.el.style.left = Math.min(
            Math.max(d.elStartX + e.clientX - d.mouseStartX, 0),
            window.innerWidth - d.el.getBoundingClientRect().width
        ) + "px";
        d.el.style.top = Math.min(
            Math.max(d.elStartY + e.clientY - d.mouseStartY, 0),
            window.innerHeight - d.el.getBoundingClientRect().height
        ) + "px";
    });
    document.addEventListener("mouseup", () => {
        if (d.el === undefined) return;
        d.el.style.transition = d.oldTransition;
        d.el = undefined
    });
    setInterval(() => { // prevent out of bounds
        const dialog = document.querySelector(".v-dialog.v-dialog--active");
        if (dialog === null) return;
        dialog.style.left = Math.min(parseInt(dialog.style.left), window.innerWidth - dialog.getBoundingClientRect().width) + "px";
        dialog.style.top = Math.min(parseInt(dialog.style.top), window.innerHeight - dialog.getBoundingClientRect().height) + "px";
    }, 100);
})()