// ==UserScript==
// @name         動畫瘋-影片下載器
// @namespace    https://shinoharahare.github.io/
// @version      0.3.1-beta
// @description  直接在瀏覽器上下載動畫瘋影片
// @author       Hare
// @updateURL    https://github.com/ShinoharaHare/Animad-Downloader.js/raw/master/index.user.js
// @downloadURL  https://github.com/ShinoharaHare/Animad-Downloader.js/raw/master/index.user.js
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @grant        GM.addStyle
// @grant        GM.getResourceText
// @grant        GM.getValue
// @grant        GM.setValue

// @resource     vuetify.scoped.css https://gitcdn.xyz/cdn/ShinoharaHare/Animad-Downloader.js/c9e1c0e7fddb7c8e873ab3895cd72ea1630fd360/public/vuetify.scoped.css
// @resource     v-dialog-dragable.css https://gitcdn.xyz/cdn/ShinoharaHare/Animad-Downloader.js/c9e1c0e7fddb7c8e873ab3895cd72ea1630fd360/public/v-dialog-dragable.css

// @require      https://cdn.jsdelivr.net/npm/vue@2.x/dist/vue.js
// @require      https://cdn.jsdelivr.net/npm/vuetify@2.x/dist/vuetify.js
// @require      https://unpkg.com/m3u8-parser@4.4.0/dist/m3u8-parser.min.js

// @require      https://gitcdn.xyz/repo/ShinoharaHare/Animad-Downloader.js/5467a9b50f4f0ecbd8cc42390633f8cf5eac6493/public/ffmpeg.js
// @require      https://gitcdn.xyz/cdn/ShinoharaHare/Animad-Downloader.js/c9e1c0e7fddb7c8e873ab3895cd72ea1630fd360/public/v-dialog-dragable.js
// ==/UserScript==

(async () => {
    'use strict';
    updateConfig()

    GM.addStyle(await GM.getResourceText('vuetify.scoped.css'))
    GM.addStyle(await GM.getResourceText('v-dialog-dragable.css'))

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
<div id="app" ref="app">
    <v-app dark>
        <v-main>
            <v-dialog hide-overlay persistent no-click-animation origin="bottom right" max-width="800" max-height="500"
                :retain-focus="false" v-model="dialog" ref="dialog">

                <template v-slot:activator="{ on, attrs }">
                    <div class="v-btn--fab v-btn--bottom  v-btn--right v-btn--fixed v-size--default" ref="fab" style="pointer-events: none;">
                        <v-fab-transition>
                            <v-btn dark fab v-bind="attrs" v-on="on" v-show="!overlapped">
                                <v-icon>mdi-download</v-icon>
                            </v-btn>
                        </v-fab-transition>
                    </div>
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
            overlapped: false,

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
                        const data = await get(url, 'arrayBuffer')

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
            this.$refs.app.style.display = null

            setInterval(() => {
                let e1 = document.querySelector('.videoframe')
                let e2 = this.$refs.fab
                if (!e1 || !e2) {
                    this.overlapped = false
                } else {
                    this.overlapped = isOverlapping(e1, e2)
                }
            }, 100)

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

function isOverlapping(e1, e2) {
    var rect1 = e1.getBoundingClientRect()
    var rect2 = e2.getBoundingClientRect()
    return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
    )
}

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
    let response = await fetch(url)
    let result = await response[responseType]()
    return result
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