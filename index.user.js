// ==UserScript==
// @name         動畫瘋-影片下載器
// @namespace    https://shinoharahare.github.io/
// @version      0.3-beta
// @description  直接在瀏覽器上下載動畫瘋影片
// @author       Hare
// @updateURL    https://github.com/ShinoharaHare/Animad-Downloader.js/raw/master/index.user.js
// @downloadURL  https://github.com/ShinoharaHare/Animad-Downloader.js/raw/master/index.user.js
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @grant        GM.addStyle
// @grant        GM.getResourceText
// @grant        GM.getResourceUrl
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @resource     vuetify.scoped.css https://gitcdn.xyz/repo/ShinoharaHare/Animad-Downloader.js/5467a9b50f4f0ecbd8cc42390633f8cf5eac6493/public/vuetify.scoped.css
// @require      https://cdn.jsdelivr.net/npm/vue@2.x/dist/vue.js
// @require      https://cdn.jsdelivr.net/npm/vuetify@2.x/dist/vuetify.js
// @require      https://unpkg.com/m3u8-parser@4.4.0/dist/m3u8-parser.min.js
// @require      https://gitcdn.xyz/repo/ShinoharaHare/Animad-Downloader.js/5467a9b50f4f0ecbd8cc42390633f8cf5eac6493/public/ffmpeg.js
// @connect      gamer-cds.cdn.hinet.net
// @connect      shinoharahare.github.io

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

    // HTML Start

    container.html(`
    <div id="app">
    <v-app dark>
        <v-main>
            <v-dialog hide-overlay persistent no-click-animation origin="bottom right" max-width="800" max-height="500"
                v-model="dialog" ref="dialog">

                <template v-slot:activator="{ on, attrs }">
                    <v-btn dark fixed bottom right fab v-bind="attrs" v-on="on">
                        <v-icon>mdi-download</v-icon>
                    </v-btn>
                </template>

                <v-card dark>
                    <v-card-title class="headline blue-grey darken-4 dragable">動畫瘋-影片下載器
                        <v-spacer></v-spacer>
                        <v-btn icon @click="dialog = false">
                            <v-icon>mdi-close</v-icon>
                        </v-btn>
                    </v-card-title>

                    <v-card flat :disabled="downloading" style="overflow-y: hidden;">
                        <v-card-title>選擇畫質</v-card-title>
                        <v-fab-transition group>
                            <div class="pa-2 text-center" v-show="!src" key="1">
                                <v-card-text class="text-subtitle-1">尚未取得影片資源，請先嘗試播放影片</v-card-text>
                                <v-progress-linear indeterminate></v-progress-linear>
                            </div>

                            <div class="pa-4" key="2">
                                <v-scale-transition group>
                                    <v-btn large rounded outlined class="mr-4" :disabled="downloading"
                                        :color="qualityColor(q)" :key="i" @click="download(q)"
                                        v-for="(q, i) in qualities">
                                        <v-icon left size="28">{{qualityIcon(q)}}</v-icon>{{q.height}}P
                                    </v-btn>
                                </v-scale-transition>
                            </div>
                        </v-fab-transition>
                    </v-card>

                    <v-divider></v-divider>

                    <v-expand-transition>
                        <v-card flat class="text-center" v-show="downloading" :key="1">
                            <v-card-title>下載進度</v-card-title>
                            <div class="text-center">{{message}} {{speed}}</div>
                            <div class="pa-2">
                                <v-progress-linear color="green" height="20" :value="progress" striped>
                                    {{progressText}}
                                </v-progress-linear>
                            </div>

                            <v-card-actions>
                                <v-spacer></v-spacer>
                                <v-btn color="red darken-3" :loading="aborting" @click="abort">取消</v-btn>
                            </v-card-actions>
                        </v-card>
                    </v-expand-transition>
                </v-card>
            </v-dialog>
        </v-main>
    </v-app>
</div>
`)

    // HTML End

    // Script Start

    let files = []
    let ffmpeg = null

    const self = new Vue({
        el: '#app',
        vuetify: new Vuetify(),
        data: {
            name: $('.anime_name h1').text(),
            src: '',
            dialog: false,
            downloading: false,
            qualities: [],
            progress: 0,
            progressText: '',
            message: '',
            downloaded: null,
            count: 0,
            aborting: false,

            bytes: 0,
            speed: ''
        },
        methods: {
            async download({ url }) {
                this.downloading = true
                this.message = '下載中...'
                this.bytes = 0
                setInterval(() => {
                    let duration = 3
                    let speed = this.bytes / duration / 1024 / 1024
                    this.speed = `${speed.toFixed(2)} MBps`
                    this.bytes = 0
                }, 3000)

                url = resolve(this.src, url)
                let m3u8 = await get(url)
                let { segments } = parseM3U8(m3u8)
                let keyUri = segments[0].key.uri
                m3u8 = m3u8.replace(keyUri, basename(keyUri))
                m3u8 = m3u8.replace(new RegExp(`\\${new URL(keyUri).search}`, 'gm'), '')
                files.push({ name: basename(url), data: str2ab(m3u8) })

                let total = segments.length
                this.downloaded = new Proxy({}, {
                    set(target, key, val) {
                        target[key] = val
                        let finished = files.length - 2
                        self.progress = parseInt(finished / total * 100)
                        self.progressText = `${finished} / ${total}`
                        return true
                    }
                })

                this.downloadSegments(resolve(url, keyUri))
                for (let { uri } of segments) {
                    if (this.aborting) {
                        return
                    }
                    if (this.count > 32) {
                        await wait(() => this.count < 32)
                    }
                    this.downloadSegments(resolve(url, uri))
                }

                await wait(() => files.length - 2 >= total)

                this.message = '合併中...'

                await sleep(500)

                ffmpeg = ffmpeg || require('ffmpeg.js')

                const result = ffmpeg({
                    MEMFS: files,
                    arguments: ['-y', '-allowed_extensions', 'ALL', '-i', basename(url), '-c', 'copy', 'output.mp4'],
                    print: function (data) { console.log(data) },
                    printErr: function (data) { console.log(data) },
                    onExit: function (code) { console.log("Process exited with code " + code); }
                })

                let blobUrl = URL.createObjectURL(new Blob([result.MEMFS[0].data], { type: 'video/mp4' }))
                triggerDownload(blobUrl, `${this.name}.mp4`)
                this.downloading = false
                this.downloaded = null
                files = []
            },
            async downloadSegments(url) {
                while (!this.downloaded[url]) {
                    try {
                        this.downloaded[url] = false
                        this.count++
                        const name = basename(url)
                        const data = await get(url, 'arraybuffer')

                        this.bytes += data.byteLength

                        files.push({ name, data })
                        this.downloaded[url] = true
                        this.count--
                    } catch (e) { }
                }
            },
            async abort() {
                this.aborting = true
                await wait(() => this.count == 0)
                this.aborting = false
                this.downloading = false
                this.downloaded = null
                files = []
            },
            qualityIcon({ height }) {
                if (height <= 360) {
                    return 'mdi-quality-low'
                } else if (height <= 540) {
                    return 'mdi-quality-medium'
                } else if (height <= 720) {
                    return 'mdi-quality-high'
                } else if (height >= 1080) {
                    return 'mdi-currency-usd-circle-outline'
                }
            },
            qualityColor({ height }) {
                if (height <= 360) {
                    return 'light-blue'
                } else if (height <= 540) {
                    return 'amber'
                } else if (height <= 720) {
                    return 'light-green'
                } else if (height >= 1080) {
                    return 'red'
                }
            }
        },
        watch: {
            dialog() {
                this.$nextTick(() => this.$refs.dialog.showScroll())
            }
        },
        async mounted() {
            this.src = await getSrc()
            let m3u8 = await get(this.src)
            let { playlists } = parseM3U8(m3u8)
            for (let playlist of playlists) {
                this.qualities.push({
                    ...playlist.attributes.RESOLUTION,
                    url: resolve(this.src, playlist.uri)
                })
                await sleep(100)
            }
        }
    })


    // Script End
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