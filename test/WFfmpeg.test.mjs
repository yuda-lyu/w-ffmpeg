import fs from 'fs'
import path from 'path'
import assert from 'assert'
import cp from 'child_process'
import WFfmpeg from '../src/WFfmpeg.mjs'


function isWindows() {
    return process.platform === 'win32'
}


describe('WFfmpeg', function() {

    //check
    if (!isWindows()) {
        return
    }

    //ffmpeg.exe經ensureBins取得: 以本機鏡像(bin/之切割zip分片, 結構<鏡像>/<套件>/<sha256>/<name>)離線供檔, 快取放於測試暫存夾, 不連外網、不寫套件根之bin-cache/
    let fdt = path.resolve('./test/_tmp/WFfmpeg')
    let manifest = JSON.parse(fs.readFileSync('bin/manifest.json', 'utf8'))
    let keys = ['W_BIN_CACHE', 'W_BIN_MIRROR', 'W_BIN_OFFLINE']
    let bak = {}
    let fetchBak = null
    let netCalls = []

    //spawnBak, spawned, 記錄子行程啟動之程式路徑(execProcess以cp.spawn啟動), 用以確認所執行者為ensureBins所回傳之快取檔而非src/之舊路徑檔
    let spawnBak = null
    let spawned = []

    before(function() {
        this.timeout(180000)
        fs.rmSync(fdt, { recursive: true, force: true })
        for (let p of manifest.files[0].parts) {
            let fd = path.join(fdt, 'mirror', manifest.pkg, p.sha256)
            fs.mkdirSync(fd, { recursive: true })
            fs.copyFileSync(p.path, path.join(fd, path.posix.basename(p.path)))
        }
        for (let k of keys) {
            bak[k] = process.env[k]
        }
        process.env.W_BIN_CACHE = path.join(fdt, 'cache')
        process.env.W_BIN_MIRROR = path.join(fdt, 'mirror')
        process.env.W_BIN_OFFLINE = '1'
        fetchBak = globalThis.fetch
        globalThis.fetch = (url) => {
            netCalls.push(String(url))
            throw new Error(`network access is forbidden in tests: ${url}`)
        }
        spawnBak = cp.spawn
        cp.spawn = (prog, ...rest) => {
            spawned.push(String(prog))
            return spawnBak(prog, ...rest)
        }
    })

    after(function() {
        cp.spawn = spawnBak
        globalThis.fetch = fetchBak
        for (let k of keys) {
            if (bak[k] === undefined) {
                delete process.env[k]
            }
            else {
                process.env[k] = bak[k]
            }
        }
        fs.rmSync(fdt, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    })

    async function test() {

        //fpIn, 測試用視訊檔
        let fpIn = './test/aigen.mp4'

        //fpOut, 提取出的音訊檔
        let fpOut = './test/aigen.mp3'

        //args, 自aigen.mp4提取音訊輸出為aigen.mp3 (-y覆蓋既有檔, -vn去除視訊軌)
        let args = ['-y', '-i', fpIn, '-vn', fpOut]

        //WFfmpeg, 執行成功時resolve(不拋錯); ffmpeg非0結束碼時execProcess會reject致此處拋出使測試失敗
        await WFfmpeg(args)

        //bExist, 輸出檔是否存在
        let bExist = fs.existsSync(fpOut)

        //len, 輸出檔大小
        let len = bExist ? fs.statSync(fpOut).size : 0

        //head, 讀檔頭前3碼判斷是否為mp3 (libmp3lame預設輸出ID3v2標頭, 起始為'ID3')
        let head = bExist ? fs.readFileSync(fpOut).slice(0, 3).toString('latin1') : ''

        //unlinkSync, 清除測試產出
        if (bExist) {
            fs.unlinkSync(fpOut)
        }

        return { bExist, len, head }
    }

    it('extract audio from mp4 to mp3', async function() {
        this.timeout(180000)
        let { bExist, len, head } = await test()

        //驗1: 提取出的mp3檔確實存在
        assert.strict.equal(bExist, true)

        //驗2: 提取出的mp3檔非空
        assert.strict.equal(len > 0, true)

        //驗3: 提取出的檔確實是mp3 (ID3標頭), 而非垃圾內容
        assert.strict.equal(head, 'ID3')

        //驗4: 未連網, 且所用之ffmpeg.exe為快取夾內經清單校驗之檔
        assert.strict.deepStrictEqual(netCalls, [])
        let fpCache = path.join(fdt, 'cache', manifest.pkg, manifest.files[0].extract.sha256, 'ffmpeg.exe')
        assert.strict.equal(fs.existsSync(fpCache), true)
        let norm = (p) => path.resolve(p).toLowerCase()
        assert.strict.equal(spawned.some((v) => norm(v) === norm(fpCache)), true, `spawned: ${spawned.join(' | ')}`) //啟動的是快取檔
        assert.strict.equal(spawned.some((v) => norm(v) === norm('./src/ffmpeg.exe')), false) //不是src/之舊路徑檔
    })

})
