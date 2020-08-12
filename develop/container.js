let files = []
let ffmpeg = null

const self = new Vue({
    el: '#app',
    vuetify: new Vuetify(),
    data: {
        name: $('.anime_name h1').text(),
        src: '',
        show: false,
        downloading: false,
        qualities: [],
        progress: 0,
        progressText: '',
        message: '',
        downloaded: null,
        count: 0,
        aborting: false
    },
    methods: {
        async download({ url }) {
            this.downloading = true
            this.message = '下載中...'
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
    async mounted() {
        this.src = await getSrc()
        let m3u8 = await get(this.src)
        let { playlists } = parseM3U8(m3u8)
        for (let playlist of playlists) {
            this.qualities.push({
                ...playlist.attributes.RESOLUTION,
                url: resolve(this.src, playlist.uri)
            })
        }
    }
});

