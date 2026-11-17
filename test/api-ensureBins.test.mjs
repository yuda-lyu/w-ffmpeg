import fs from 'fs'
import os from 'os'
import path from 'path'
import http from 'http'
import assert from 'assert'
import crypto from 'crypto'
import { spawnSync } from 'child_process'
import ensureBins from '../src/ensureBins.mjs'
import autoDownloadFiles from '../src/autoDownloadFiles.mjs'
import WFfmpeg from '../src/WFfmpeg.mjs'


function isWindows() {
    return process.platform === 'win32'
}


//規格: 外部執行檔之存放下載校驗與離線(制式規格) D1~D4、O1~O4、E2、E3、§8 T3~T7(T8為主幹模式專屬, 本套件為釘選模式故不適用)
//自有分割壓縮檔(bin/ffmpeg.zip.001~005)經本機HTTP伺服器(扮GitHub原始檔, fetch只改主機指向本機)與本地資料夾(扮鏡像與快取), 真實組合、解壓與校驗, 不連外網
describe(`ensureBins`, function() {
    this.timeout(180000)

    let RAW = 'https://raw.githubusercontent.com'
    let port = 8971
    let fdt = path.resolve('./test/_tmp/ensureBins')
    let manifest = JSON.parse(fs.readFileSync('bin/manifest.json', 'utf8'))
    let entry = manifest.files[0]
    let name = entry.name
    let pkgName = manifest.pkg
    let sha256 = entry.extract.sha256
    let size = entry.extract.size
    let parts = entry.parts
    let nameOf = (p) => path.posix.basename(p.path)
    let urlsPinned = parts.map((p) => `${RAW}/${manifest.repo}/${manifest.commit}/${p.path}`)

    //伺服器狀態: mode為good、flip(第3分割同長度不同內容)、short(第5分割少1位元組)、missing(404)
    let mode = 'good'
    let hits = []
    let server = null

    //fetch, 只接受GitHub原始檔網址並改指本機伺服器, 其餘(外網)一律拋錯; urls記錄被請求之原網址
    let urls = []
    let fetch = (url, init) => {
        let u = String(url)
        urls.push(u)
        if (!u.startsWith(`${RAW}/`)) {
            throw new Error(`unexpected url[${u}]`)
        }
        return globalThis.fetch(u.replace(RAW, `http://127.0.0.1:${port}`), init)
    }

    //fetchBan, 任何網路請求皆視為錯誤(用於斷言未連網)
    let fetchBan = (url) => {
        urls.push(String(url))
        throw new Error(`network access is not allowed in this case[${url}]`)
    }

    let flip = (buf, i = 1000) => {
        let b = Buffer.from(buf)
        b[i] = b[i] ^ 0xff
        return b
    }

    let hashOf = async(fp) => {
        let h = crypto.createHash('sha256')
        for await (let chunk of fs.createReadStream(fp)) {
            h.update(chunk)
        }
        return { sha256: h.digest('hex'), size: fs.statSync(fp).size }
    }

    //listFiles, 遞迴列出資料夾內所有檔案(不存在回傳空陣列)
    let listFiles = (fd) => {
        if (!fs.existsSync(fd)) {
            return []
        }
        return fs.readdirSync(fd, { recursive: true, withFileTypes: true }).filter((v) => v.isFile()).map((v) => path.join(v.parentPath, v.name))
    }

    //每案獨立資料夾, afterEach刪除(每份快取含122MB之ffmpeg.exe), seed與鏡像例外
    let seq = 0
    let temps = []
    let newDir = (tag) => {
        seq++
        let fd = path.join(fdt, `${tag}-${seq}`)
        temps.push(fd)
        return fd
    }

    //putPart, 把bin/之第i分割依鏡像結構(<鏡像>/<套件>/<sha256>/<name>)放入, flipped時放入同長度但內容不同之副本
    let putPart = (mirror, i, flipped = false) => {
        let p = parts[i]
        let fd = path.join(mirror, pkgName, p.sha256)
        fs.mkdirSync(fd, { recursive: true })
        let b = fs.readFileSync(p.path)
        fs.writeFileSync(path.join(fd, nameOf(p)), flipped ? flip(b) : b)
    }
    let mkMirrorParts = (flippedIndex = -1) => {
        let mirror = newDir('mirror')
        for (let i = 0; i < parts.length; i++) {
            putPart(mirror, i, i === flippedIndex)
        }
        return mirror
    }

    //withEnv, 暫時設定環境變數(值為undefined代表刪除), 結束後還原
    let withEnv = async(vars, fun) => {
        let old = {}
        for (let k of Object.keys(vars)) {
            old[k] = process.env[k]
            if (vars[k] === undefined) {
                delete process.env[k]
            }
            else {
                process.env[k] = vars[k]
            }
        }
        try {
            return await fun()
        }
        finally {
            for (let k of Object.keys(vars)) {
                if (old[k] === undefined) {
                    delete process.env[k]
                }
                else {
                    process.env[k] = old[k]
                }
            }
        }
    }

    let catchErr = async(fun) => {
        try {
            await fun()
        }
        catch (err) {
            return err
        }
        return null
    }

    //seed, 共用之已備齊快取(<seed>/<套件>/<sha256>/<name>, 其結構即鏡像結構, 規格O4), 於before以鏡像取得一次
    let seed = path.join(fdt, 'seed')
    let fpSeed = path.join(seed, pkgName, sha256, name)

    before(async function() {
        fs.rmSync(fdt, { recursive: true, force: true })
        fs.mkdirSync(fdt, { recursive: true })
        server = http.createServer((req, res) => {
            hits.push(req.url)
            let m = /^\/yuda-lyu\/w-ffmpeg\/[0-9a-f]{40}\/bin\/(ffmpeg\.zip\.00[1-5])$/.exec(req.url)
            let i = m === null ? -1 : parts.findIndex((p) => nameOf(p) === m[1])
            if (mode === 'missing' || i < 0) {
                res.writeHead(404)
                res.end()
                return
            }
            let body = fs.readFileSync(parts[i].path)
            if (mode === 'flip' && i === 2) {
                body = flip(body)
            }
            if (mode === 'short' && i === 4) {
                body = body.subarray(0, body.length - 1)
            }
            res.writeHead(200, { 'content-length': String(body.length) })
            res.end(body)
        })
        await new Promise((resolve, reject) => {
            server.once('error', reject)
            server.listen(port, '127.0.0.1', resolve)
        })

        //seed, 自分割鏡像取得(離線)
        let mirror = path.join(fdt, 'mirror-parts')
        for (let i = 0; i < parts.length; i++) {
            putPart(mirror, i)
        }
        await ensureBins({ cacheDir: path.join(seed, pkgName), mirror, offline: true, fetch: fetchBan })
    })

    after(async function() {
        await new Promise((resolve) => {
            server.close(resolve)
        })
        fs.rmSync(fdt, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    })

    beforeEach(function() {
        mode = 'good'
        hits = []
        urls = []
    })

    afterEach(function() {
        for (let fd of temps) {
            fs.rmSync(fd, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
        }
        temps = []
    })

    it(`should have a seed cache whose ${name} equals the extracted member of the manifest (M1, M2, D5)`, async function() {
        assert.strict.deepStrictEqual(await hashOf(fpSeed), { sha256, size })
    })

    it(`should export ensureBins as the static property WFfmpeg.ensureBins (D1, E2)`, function() {
        assert.strict.equal(typeof ensureBins, 'function')
        assert.strict.equal(WFfmpeg.ensureBins, ensureBins)
    })

    it(`should download the pinned parts, assemble, extract, verify and cache only the final file; the second call hits the cache without network (T3, D1, D3, D4, D5, O2, F3)`, async function() {
        let cacheDir = newDir('cache')

        let r1 = await ensureBins({ cacheDir, fetch, mirror: '', offline: false })
        assert.strict.deepStrictEqual(Object.keys(r1), [name])
        assert.strict.equal(r1[name], path.join(cacheDir, sha256, name)) //D3: <快取>/<sha256>/<name>
        assert.strict.deepStrictEqual(await hashOf(r1[name]), { sha256, size }) //M2、D5: 解出之檔符合extract
        assert.strict.deepStrictEqual(urls, urlsPinned) //O2: 依序取得釘選提交之5個分割, 非master、非releases/latest
        assert.strict.equal(hits.length, 5)
        assert.strict.deepStrictEqual(listFiles(cacheDir), [r1[name]]) //F3: 快取只存最終檔, 不留分割檔、組合zip與暫存夾

        let r2 = await ensureBins({ cacheDir, fetch: fetchBan, mirror: '', offline: false })
        assert.strict.equal(r2[name], r1[name]) //D4: 命中且不連網
        assert.strict.equal(hits.length, 5)
        assert.strict.equal(urls.length, 5)
    })

    it(`should reject a part whose bytes differ from the manifest and leave no file (T4, M2, D2)`, async function() {
        mode = 'flip'
        let cacheDir = newDir('cache')
        let err = await catchErr(() => ensureBins({ cacheDir, fetch, mirror: '', offline: false, maxAttempts: 1 }))
        assert.strict.equal(err && err.code, 'E_HASH_MISMATCH', err && err.message)
        assert.strict.deepStrictEqual(listFiles(cacheDir), []) //前2個分割已取得但不留
    })

    it(`should reject a part whose size differs from the manifest and leave no file (T4, M2, D2)`, async function() {
        mode = 'short'
        let cacheDir = newDir('cache')
        let err = await catchErr(() => ensureBins({ cacheDir, fetch, mirror: '', offline: false, maxAttempts: 1 }))
        assert.strict.equal(err && err.code, 'E_SIZE_MISMATCH', err && err.message)
        assert.strict.deepStrictEqual(listFiles(cacheDir), [])
    })

    it(`should reject an HTTP error status without leaving a file (T4, E3)`, async function() {
        mode = 'missing'
        let cacheDir = newDir('cache')
        let err = await catchErr(() => ensureBins({ cacheDir, fetch, mirror: '', offline: false, maxAttempts: 1 }))
        assert.strict.equal(err && err.code, 'E_HTTP', err && err.message)
        assert.strict.deepStrictEqual(listFiles(cacheDir), [])
    })

    it(`should get the file from a local folder mirror holding the split parts without network (T5, O1, O2, O3)`, async function() {
        let mirror = mkMirrorParts()
        let cacheDir = newDir('cache')
        let r = await ensureBins({ cacheDir, fetch: fetchBan, mirror, offline: true })
        assert.strict.equal(r[name], path.join(cacheDir, sha256, name))
        assert.strict.deepStrictEqual(await hashOf(r[name]), { sha256, size })
        assert.strict.deepStrictEqual(listFiles(cacheDir), [r[name]])
        assert.strict.deepStrictEqual(urls, [])
        assert.strict.equal(hits.length, 0)
    })

    it(`should use a W_BIN_CACHE folder as a mirror that holds the final file, and refuse the final file when it is tampered (T5, O1, O4)`, async function() {
        //O4: 設W_BIN_CACHE=<資料夾>取得所得之資料夾即為鏡像(結構<資料夾>/<套件>/<sha256>/<name>)
        let envRoot = newDir('envroot')
        let rEnv = await withEnv({ W_BIN_CACHE: envRoot, W_BIN_MIRROR: undefined, W_BIN_OFFLINE: undefined }, () => {
            return ensureBins({ fetch, mirror: '', offline: false })
        })
        assert.strict.equal(rEnv[name], path.join(envRoot, pkgName, sha256, name))
        assert.strict.equal(hits.length, 5)

        hits = []
        let cacheDir = newDir('cache')
        let r = await ensureBins({ cacheDir, fetch: fetchBan, mirror: envRoot, offline: true })
        assert.strict.equal(r[name], path.join(cacheDir, sha256, name))
        assert.strict.deepStrictEqual(await hashOf(r[name]), { sha256, size })
        assert.strict.equal(hits.length, 0)

        //最終檔被竄改(同長度): 離線時拒用且不進快取
        let fdBad = path.join(envRoot, pkgName, sha256)
        fs.writeFileSync(path.join(fdBad, name), flip(fs.readFileSync(path.join(fdBad, name)), 5000))
        let cacheDir2 = newDir('cache')
        let err = await catchErr(() => ensureBins({ cacheDir: cacheDir2, fetch: fetchBan, mirror: envRoot, offline: true }))
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
        assert.strict.deepStrictEqual(listFiles(cacheDir2), [])
    })

    it(`should refuse a tampered mirror part: offline fails with E_OFFLINE_MISSING and caches nothing (T5, O2)`, async function() {
        let mirror = mkMirrorParts(1)
        let cacheDir = newDir('cache')
        let err = await catchErr(() => ensureBins({ cacheDir, fetch: fetchBan, mirror, offline: true }))
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
        assert.strict.deepStrictEqual(listFiles(cacheDir), [])
        assert.strict.equal(hits.length, 0)
    })

    it(`should fall back to GitHub when a mirror part is tampered and online, still verified, and leave the mirror untouched (T5, O2)`, async function() {
        let mirror = mkMirrorParts(1)
        let cacheDir = newDir('cache')
        let r = await ensureBins({ cacheDir, fetch, mirror, offline: false })
        assert.strict.deepStrictEqual(await hashOf(r[name]), { sha256, size })
        assert.strict.equal(urls.includes(urlsPinned[1]), true) //被竄改之分割改自GitHub取得
        assert.strict.equal(urls.includes(urlsPinned[0]), false) //其餘分割取自鏡像
        let fpMirrorPart = path.join(mirror, pkgName, parts[1].sha256, nameOf(parts[1]))
        assert.strict.equal(fs.readFileSync(fpMirrorPart).equals(flip(fs.readFileSync(parts[1].path))), true)
    })

    //規格 T6/O3(2026-11-18改)與〈輸入參數之檢測機制〉V20: 訊息只列缺哪個檔(名稱)與準備方法, 不帶sha256、大小、路徑與網址; 這些改放錯誤物件之結構欄位err.missing[](結構欄位屬契約, 不在「訊息」之限)
    it(`should reject offline with E_OFFLINE_MISSING naming only the file in the message and giving the sha256, size, cache path and the mirror paths of the parts in err.missing[] when nothing is available (T6, O3, E3, V20)`, async function() {
        //無鏡像(mirror為空字串): mirrorPath為null
        let cacheDir = newDir('cache')
        let err = await catchErr(() => ensureBins({ cacheDir, fetch: fetchBan, mirror: '', offline: true }))
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
        let cachePath = path.join(cacheDir, sha256, name)

        //訊息: 含缺檔之檔名; 不含sha256(最終檔與各分割)、大小、快取路徑、快取資料夾、各分割之來源網址
        assert.strict.equal(err.message.includes(name), true, err.message)
        assert.strict.equal(err.message.includes(sha256), false, err.message)
        assert.strict.equal(err.message.includes(`${size}`), false, err.message)
        assert.strict.equal(err.message.includes(cachePath), false, err.message)
        assert.strict.equal(err.message.includes(cacheDir), false, err.message)
        for (let i = 0; i < parts.length; i++) {
            assert.strict.equal(err.message.includes(parts[i].sha256), false, err.message)
            assert.strict.equal(err.message.includes(urlsPinned[i]), false, err.message)
        }

        //結構欄位err.missing[](原案由訊息驗之資訊: 哪個檔、sha256、大小、應放之快取路徑、各分割之位置): 單一缺檔項, 欄位逐一斷言
        assert.strict.equal(Array.isArray(err.missing), true)
        assert.strict.equal(err.missing.length, 1)
        let m = err.missing[0]
        assert.strict.deepStrictEqual([m.name, m.sha256, m.size, m.cachePath], [name, sha256, size, cachePath])
        assert.strict.equal(m.mirrorPath, null) //未設鏡像
        assert.strict.equal(m.url, null) //來源為分割壓縮檔, 無直接網址
        assert.strict.equal(m.member, entry.extract.member) //自壓縮檔解出之成員
        assert.strict.equal(m.archive, null)
        assert.strict.equal(m.bundle, null) //單一檔非檔案組
        assert.strict.equal(Array.isArray(m.reasons), true)
        assert.strict.deepStrictEqual(
            m.parts.map((p) => [p.name, p.sha256, p.size, p.url, p.mirrorPath]),
            parts.map((p, i) => [nameOf(p), p.sha256, p.size, urlsPinned[i], null]),
        )

        assert.strict.deepStrictEqual(urls, [])
        assert.strict.equal(hits.length, 0)
        assert.strict.deepStrictEqual(listFiles(cacheDir), [])

        //有鏡像(空資料夾)而離線: 最終檔與各分割之mirrorPath為<鏡像>/<套件>/<sha256>/<name>(原案由訊息驗各分割之鏡像位置); 訊息仍不帶該位置
        let mirror = newDir('mirror-empty')
        fs.mkdirSync(mirror, { recursive: true })
        let cacheDir2 = newDir('cache')
        let err2 = await catchErr(() => ensureBins({ cacheDir: cacheDir2, fetch: fetchBan, mirror, offline: true }))
        assert.strict.equal(err2 && err2.code, 'E_OFFLINE_MISSING', err2 && err2.message)
        assert.strict.equal(err2.message.includes(name), true, err2.message)
        assert.strict.equal(err2.message.includes(mirror), false, err2.message)
        assert.strict.equal(err2.message.includes(sha256), false, err2.message)
        assert.strict.equal(err2.missing.length, 1)
        let m2 = err2.missing[0]
        assert.strict.deepStrictEqual([m2.name, m2.sha256, m2.size, m2.cachePath], [name, sha256, size, path.join(cacheDir2, sha256, name)])
        assert.strict.equal(m2.mirrorPath, path.join(mirror, pkgName, sha256, name))
        assert.strict.deepStrictEqual(m2.parts.map((p) => p.mirrorPath), parts.map((p) => path.join(mirror, pkgName, p.sha256, nameOf(p))))
        assert.strict.deepStrictEqual(urls, [])
        assert.strict.deepStrictEqual(listFiles(cacheDir2), [])
    })

    it(`should re-obtain the file when the cached file was altered with the same size (T7, D4)`, async function() {
        let cacheDir = newDir('cache')
        let mirror = mkMirrorParts()
        let r1 = await ensureBins({ cacheDir, fetch: fetchBan, mirror, offline: true })

        fs.writeFileSync(r1[name], flip(fs.readFileSync(r1[name]), 5000))
        assert.strict.notEqual((await hashOf(r1[name])).sha256, sha256)

        let r2 = await ensureBins({ cacheDir, fetch: fetchBan, mirror, offline: true })
        assert.strict.equal(r2[name], r1[name])
        assert.strict.deepStrictEqual(await hashOf(r2[name]), { sha256, size })
    })

    it(`should re-obtain from GitHub when the cached file was truncated and nothing else is available (T7, D4)`, async function() {
        let cacheDir = newDir('cache')
        let r1 = await ensureBins({ cacheDir, fetch, mirror: '', offline: false })
        assert.strict.equal(hits.length, 5)

        fs.truncateSync(r1[name], 1024) //大小不符

        let r2 = await ensureBins({ cacheDir, fetch, mirror: '', offline: false })
        assert.strict.deepStrictEqual(await hashOf(r2[name]), { sha256, size })
        assert.strict.equal(hits.length, 10)
    })

    it(`should read W_BIN_CACHE, W_BIN_MIRROR and W_BIN_OFFLINE from the environment (D3, O1, O3)`, async function() {
        let mirror = mkMirrorParts()
        let envRoot = newDir('envroot')
        let r = await withEnv({ W_BIN_CACHE: envRoot, W_BIN_MIRROR: mirror, W_BIN_OFFLINE: '1' }, () => {
            return ensureBins({ fetch: fetchBan })
        })
        //D3: 共用快取為<W_BIN_CACHE>/<套件>/<sha256>/<name>
        assert.strict.equal(r[name], path.join(envRoot, pkgName, sha256, name))
        assert.strict.deepStrictEqual(await hashOf(r[name]), { sha256, size })
        assert.strict.equal(hits.length, 0)

        //W_BIN_OFFLINE=1且無快取無鏡像: E_OFFLINE_MISSING, 不連網
        let envRoot2 = newDir('envroot')
        let err = await withEnv({ W_BIN_CACHE: envRoot2, W_BIN_MIRROR: undefined, W_BIN_OFFLINE: '1' }, () => {
            return catchErr(() => ensureBins({ fetch: fetchBan }))
        })
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
        //O3、V20: 應放之快取位置(<W_BIN_CACHE>/<套件>/<sha256>/<name>)在err.missing[0].cachePath, 訊息只含檔名而不含該路徑
        assert.strict.equal(err.missing.length, 1)
        assert.strict.deepStrictEqual([err.missing[0].name, err.missing[0].sha256, err.missing[0].size], [name, sha256, size])
        assert.strict.equal(err.missing[0].cachePath, path.join(envRoot2, pkgName, sha256, name))
        assert.strict.equal(err.missing[0].mirrorPath, null) //W_BIN_MIRROR未設
        assert.strict.equal(err.message.includes(name), true, err.message)
        assert.strict.equal(err.message.includes(envRoot2), false, err.message)
        assert.strict.deepStrictEqual(urls, [])
    })

    it(`should place the default cache under the package root even when the module is loaded from another working directory (D3)`, function() {
        //pkgRoot於模組載入時決定, 故以子行程於他處工作目錄載入(被安裝為相依套件時, 載入時之工作目錄為使用者專案而非套件根)
        //為不在本套件根建立bin-cache/(fsEnsureBins離線缺檔時亦會建立空的快取根)且不受開發機既有快取影響, 於暫存夾組一個假套件根(src/ensureBins.mjs之副本＋bin/manifest.json)
        let fdPkg = path.join(fdt, 'pkg')
        fs.mkdirSync(path.join(fdPkg, 'src'), { recursive: true })
        fs.mkdirSync(path.join(fdPkg, 'bin'), { recursive: true })
        fs.copyFileSync('src/ensureBins.mjs', path.join(fdPkg, 'src/ensureBins.mjs'))
        fs.copyFileSync('bin/manifest.json', path.join(fdPkg, 'bin/manifest.json'))
        let env = { ...process.env }
        for (let k of ['W_BIN_CACHE', 'W_BIN_MIRROR', 'W_BIN_OFFLINE']) {
            delete env[k]
        }
        let cwdOther = os.tmpdir()
        let r = spawnSync(process.execPath, [path.resolve('test/tools/ensureBinsChild.mjs'), path.join(fdPkg, 'src/ensureBins.mjs')], { cwd: cwdOther, env, encoding: 'utf8', windowsHide: true })
        assert.strict.equal(r.status, 0, r.stderr)
        let o = JSON.parse(r.stdout.trim().split('\n').pop())
        assert.strict.equal(path.resolve(o.cwd), path.resolve(cwdOther)) //確實於他處載入
        assert.strict.equal(o.code, 'E_OFFLINE_MISSING')
        assert.strict.equal(o.cachePath, path.join(fdPkg, 'bin-cache', sha256, name)) //缺檔之應放路徑為(假)套件根下之預設快取, 與cwd無關
    })

    it(`should not forward floatingManifestUrl, which would change the trust anchor of the manifest (E2)`, async function() {
        //floatingManifestUrl只在主幹模式生效, 但被轉傳時無效值會使fsEnsureBins以E_ARG拒絕; 套件端丟棄它故仍正常取得
        let cacheDir = newDir('cache')
        let r = await ensureBins({ cacheDir, fetch: fetchBan, mirror: path.join(fdt, 'mirror-parts'), offline: true, floatingManifestUrl: 'not-a-valid-url' })
        assert.strict.deepStrictEqual(await hashOf(r[name]), { sha256, size })
        assert.strict.equal(hits.length, 0)
    })

})


//autoDownloadFiles(舊下載入口, 深層匯入點)與WFfmpeg主函數無法注入fetch, 故攔截全域fetch: 被呼叫即記錄並拋錯, 斷言未被呼叫(否則回歸為直連時測試仍會因真網路而綠)
describe(`entries without an injectable fetch`, function() {
    this.timeout(180000)

    let fdt = path.resolve('./test/_tmp/ensureBinsEntries')
    let manifest = JSON.parse(fs.readFileSync('bin/manifest.json', 'utf8'))
    let entry = manifest.files[0]
    let name = entry.name
    let pkgName = manifest.pkg
    let sha256 = entry.extract.sha256
    let keys = ['W_BIN_CACHE', 'W_BIN_MIRROR', 'W_BIN_OFFLINE']
    let bak = {}
    let fetchBak = null
    let netCalls = []
    let mirror = path.join(fdt, 'mirror')

    let setEnv = (vars) => {
        for (let k of keys) {
            if (vars[k] === undefined) {
                delete process.env[k]
            }
            else {
                process.env[k] = vars[k]
            }
        }
    }

    before(function() {
        fetchBak = globalThis.fetch
        globalThis.fetch = (url) => {
            netCalls.push(String(url))
            throw new Error(`network access is forbidden in tests: ${url}`)
        }
        for (let k of keys) {
            bak[k] = process.env[k]
        }
        fs.rmSync(fdt, { recursive: true, force: true })
        for (let p of entry.parts) {
            let fd = path.join(mirror, pkgName, p.sha256)
            fs.mkdirSync(fd, { recursive: true })
            fs.copyFileSync(p.path, path.join(fd, path.posix.basename(p.path)))
        }
    })

    after(function() {
        globalThis.fetch = fetchBak
        setEnv(bak)
        fs.rmSync(fdt, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    })

    beforeEach(function() {
        netCalls = []
    })

    it(`should catch a call to the global fetch (the interception below is effective)`, async function() {
        //對照案: 不離線且未注入fetch時, 下載核心使用全域fetch, 本攔截必須記錄到, 其他案之netCalls為空才有意義
        setEnv({ W_BIN_CACHE: path.join(fdt, 'cache-probe') })
        let err = await ensureBins({ mirror: '', offline: false, maxAttempts: 1, retryDelayMs: 0 }).catch((e) => e)
        assert.strict.equal(err instanceof Error, true)
        assert.strict.equal(netCalls.length > 0, true)
        assert.strict.equal(netCalls[0].startsWith(`https://raw.githubusercontent.com/${manifest.repo}/${manifest.commit}/bin/ffmpeg.zip.001`), true, netCalls[0])
    })

    it(`should return { fpExe } of the verified cached file from autoDownloadFiles without network, and share concurrent calls (E2, D4)`, async function() {
        setEnv({ W_BIN_CACHE: path.join(fdt, 'cache-a'), W_BIN_MIRROR: mirror, W_BIN_OFFLINE: '1' })
        let rs = await Promise.all([autoDownloadFiles(), autoDownloadFiles(), autoDownloadFiles()])
        assert.strict.deepStrictEqual(netCalls, [])
        assert.strict.deepStrictEqual(Object.keys(rs[0]), ['fpExe'])
        assert.strict.equal(rs[0].fpExe, path.join(fdt, 'cache-a', pkgName, sha256, name))
        assert.strict.equal(new Set(rs.map((v) => v.fpExe)).size, 1)
        let h = crypto.createHash('sha256').update(fs.readFileSync(rs[0].fpExe)).digest('hex')
        assert.strict.equal(h, sha256)
    })

    it(`should reject autoDownloadFiles with an Error carrying E_OFFLINE_MISSING when offline with nothing available (E3)`, async function() {
        setEnv({ W_BIN_CACHE: path.join(fdt, 'cache-b'), W_BIN_OFFLINE: '1' })
        let err = await autoDownloadFiles().catch((e) => e)
        assert.strict.equal(err instanceof Error, true)
        assert.strict.equal(err.code, 'E_OFFLINE_MISSING', err.message)
        //V20: 訊息只含檔名, 應放之位置與sha256在err.missing[](autoDownloadFiles不包裝, 原錯誤物件之結構欄位原樣保留)
        let cachePath = path.join(fdt, 'cache-b', pkgName, sha256, name)
        assert.strict.equal(err.message.includes(name), true, err.message)
        assert.strict.equal(err.message.includes(sha256), false, err.message)
        assert.strict.equal(err.message.includes(cachePath), false, err.message)
        assert.strict.equal(err.missing.length, 1)
        assert.strict.deepStrictEqual([err.missing[0].name, err.missing[0].sha256, err.missing[0].cachePath], [name, sha256, cachePath])
        assert.strict.deepStrictEqual(netCalls, [])
    })

    it(`should run ffmpeg through WFfmpeg with the file obtained by ensureBins from the local mirror, offline (D1, O3)`, async function() {
        if (!isWindows()) {
            this.skip()
        }
        setEnv({ W_BIN_CACHE: path.join(fdt, 'cache-c'), W_BIN_MIRROR: mirror, W_BIN_OFFLINE: '1' })
        let out = ''
        let cbStdout = (msg) => {
            out += String(msg)
        }
        await WFfmpeg(['-version'], { cbStdout })
        assert.strict.deepStrictEqual(netCalls, [])
        assert.strict.equal(out.includes('ffmpeg version'), true, out)
        assert.strict.equal(fs.existsSync(path.join(fdt, 'cache-c', pkgName, sha256, name)), true) //取得之路徑在快取夾, 非src/
    })

    it(`should keep the string rejection of WFfmpeg and present the failure of obtaining ffmpeg.exe as "[code] message" (E3)`, async function() {
        if (!isWindows()) {
            this.skip()
        }
        setEnv({ W_BIN_CACHE: path.join(fdt, 'cache-d'), W_BIN_OFFLINE: '1' })
        let err = await WFfmpeg(['-version']).catch((e) => e)
        assert.strict.equal(typeof err, 'string') //既有之reject型態為字串
        assert.strict.equal(err.startsWith('[E_OFFLINE_MISSING] '), true, err)

        //V20: 字串只含檔名與固定之離線準備說明(呼叫ensureBins()讀err.missing[]), 不含sha256、大小、快取路徑
        let cachePath = path.join(fdt, 'cache-d', pkgName, sha256, name)
        assert.strict.equal(err, `[E_OFFLINE_MISSING] ${name}: missing from the cache and the mirror while offline; for offline preparation call ensureBins() and read err.missing[] (cachePath, mirrorPath) to get where to put it`)
        assert.strict.equal(err.includes(sha256), false, err)
        assert.strict.equal(err.includes(cachePath), false, err)
        assert.strict.equal(err.includes(path.join(fdt, 'cache-d')), false, err)

        //字串所指引之作法可行(原案由字串驗之sha256與應放位置, 改由其指引之ensureBins()之err.missing[]驗): 同環境呼叫ensureBins()得到帶code與missing之Error
        let eb = await ensureBins({ names: name }).catch((e) => e)
        assert.strict.equal(eb instanceof Error, true)
        assert.strict.equal(eb.code, 'E_OFFLINE_MISSING', eb.message)
        assert.strict.deepStrictEqual(eb.missing.map((v) => [v.name, v.sha256, v.size, v.cachePath]), [[name, sha256, entry.extract.size, cachePath]])
        assert.strict.deepStrictEqual(netCalls, [])

        //既有之輸入檢核訊息不變
        let e2 = await WFfmpeg(123).catch((e) => e)
        assert.strict.equal(e2, 'args is not an effective array or string')
    })

})
