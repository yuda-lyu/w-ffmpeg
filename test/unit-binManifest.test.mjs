import fs from 'fs'
import path from 'path'
import assert from 'assert'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { execSync, execFileSync } from 'child_process'
import fsGetBinManifestEntry from 'wsemi/src/fsGetBinManifestEntry.mjs'
import fsEnsureBins from 'wsemi/src/fsEnsureBins.mjs'
import * as nsMain from '../src/WFfmpeg.mjs'


let partNames = ['ffmpeg.zip.001', 'ffmpeg.zip.002', 'ffmpeg.zip.003', 'ffmpeg.zip.004', 'ffmpeg.zip.005']


//規格: 外部執行檔之存放下載校驗與離線(制式規格) S1、S2、S5、M1、M2、M4、D1、E2、§8 T1、T2
describe(`bin/manifest.json`, function() {
    this.timeout(180000)

    let fdt = './test/_tmp/binManifest'
    let fdDecoy = './bin-cache/__decoy__'

    //manifestOf, 清單在it內讀(缺清單時單案失敗而非整檔載入失敗)
    let manifestOf = () => {
        return JSON.parse(fs.readFileSync('bin/manifest.json', 'utf8'))
    }

    after(function() {
        fs.rmSync(fdt, { recursive: true, force: true })
        fs.rmSync(fdDecoy, { recursive: true, force: true })

        //誘餌檔可能使bin-cache/被建立: 空夾才移除(開發機已有快取時不動)
        try {
            fs.rmdirSync('./bin-cache')
        }
        catch (err) {} // eslint-disable-line no-empty
    })

    it(`should declare the pinned manifest of this package with the split archive (M1, M2, S4)`, function() {
        let manifest = manifestOf()
        assert.strict.equal(manifest.schema, 1)
        assert.strict.equal(manifest.pkg, 'w-ffmpeg')
        assert.strict.equal(manifest.mode, 'pinned')
        assert.strict.equal(manifest.repo, 'yuda-lyu/w-ffmpeg')
        assert.strict.equal(/^[0-9a-f]{40}$/.test(manifest.commit), true, manifest.commit)
        assert.strict.deepStrictEqual(manifest.files.map((v) => v.name), ['ffmpeg.exe'])

        //M1: 分割檔之sha256與大小記於各分割與assembled, 頂層不記
        let f = manifest.files[0]
        assert.strict.deepStrictEqual(f.parts.map((v) => v.path), partNames.map((v) => `bin/${v}`))
        assert.strict.equal(f.sha256, undefined)
        assert.strict.equal(f.size, undefined)
        assert.strict.equal(f.assembled.type, 'zip')
        assert.strict.equal(f.extract.type, 'zip')
        assert.strict.equal(f.extract.member, 'ffmpeg.exe')
        for (let p of [...f.parts, f.assembled, f.extract]) {
            assert.strict.equal(/^[0-9a-f]{64}$/.test(p.sha256), true)
            assert.strict.equal(Number.isInteger(p.size) && p.size > 0, true)
        }
        assert.strict.equal(f.parts.reduce((a, v) => a + v.size, 0), f.assembled.size)
        assert.strict.equal(f.parts.every((v) => v.size <= 100 * 1024 * 1024), true) //S4: 單檔不逾100MB
    })

    it(`should pass the schema check of fsEnsureBins (M1, M2)`, async function() {
        //離線且快取為空資料夾: 清單有效時為E_OFFLINE_MISSING(缺檔), 清單無效時為E_MANIFEST; 不連網
        let err = null
        try {
            await fsEnsureBins('bin/manifest.json', { pkgRoot: '.', cacheDir: `${fdt}/cache`, mirror: '', offline: true })
        }
        catch (e) {
            err = e
        }
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
    })

    it(`should match the real files in bin/ and the assembled archive (M4, T2)`, async function() {
        let manifest = manifestOf()
        for (let f of manifest.files) {
            let h = crypto.createHash('sha256')
            let total = 0
            for (let p of [f, ...(f.parts || [])]) {
                if (typeof p.path === 'string') {
                    let e = await fsGetBinManifestEntry(p.path)
                    assert.strict.deepStrictEqual([e.sha256, e.size], [p.sha256, p.size], p.path)
                }
            }
            for (let p of f.parts) {
                for await (let chunk of fs.createReadStream(p.path)) {
                    h.update(chunk)
                    total += chunk.length
                }
            }
            assert.strict.deepStrictEqual([h.digest('hex'), total], [f.assembled.sha256, f.assembled.size])
        }
    })

    it(`should pin a commit whose bin/ holds exactly the bytes of the work tree (M2, U1)`, function() {
        let manifest = manifestOf()
        let git = (args, opt = {}) => {
            return execFileSync('git', args, { windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...opt })
        }

        //淺層clone(如CI)不含該提交, 略過
        if (git(['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() === 'true') {
            this.skip()
        }

        git(['cat-file', '-e', `${manifest.commit}^{commit}`], { stdio: 'ignore' })
        for (let p of manifest.files[0].parts) {
            let b = git(['show', `${manifest.commit}:${p.path}`])
            assert.strict.equal(crypto.createHash('sha256').update(b).digest('hex'), p.sha256, p.path)
            assert.strict.equal(b.length, p.size, p.path)
        }
    })

    it(`should keep the legacy src/ffmpeg.zip.001~005 identical to bin/ (S2, older versions download them from master)`, async function() {
        for (let n of partNames) {
            let a = await fsGetBinManifestEntry(`bin/${n}`)
            let b = await fsGetBinManifestEntry(`src/${n}`)
            assert.strict.deepStrictEqual([b.sha256, b.size], [a.sha256, a.size], n)
        }
    })

    it(`should document the external executable in the README (O5)`, function() {
        let c = fs.readFileSync('README.md', 'utf8')
        let sec = c.slice(c.indexOf('## 外部執行檔'))
        assert.strict.equal(c.includes('## 外部執行檔'), true)
        for (let k of ['W_BIN_CACHE', 'W_BIN_MIRROR', 'W_BIN_OFFLINE', 'ffmpeg.exe', 'ensureBins', 'bin/manifest.json']) {
            assert.strict.equal(sec.includes(k), true, `README section lacks ${k}`)
        }
    })

    it(`should keep the cache folder out of git and treat bin/ as binary so that the work tree bytes equal the GitHub blobs (S5, M1 F12)`, function() {
        //S5: .gitignore列bin-cache/(快取不入版控); M1補充: .gitattributes設bin/** binary(autocrlf不得改動分割檔)
        execFileSync('git', ['check-ignore', '-q', '--', 'bin-cache/x/ffmpeg.exe'], { windowsHide: true }) //被忽略時離開碼0, 否則拋錯
        execFileSync('git', ['check-ignore', '-q', '--', 'test/_tmp/x/ffmpeg.exe'], { windowsHide: true })
        let attr = execFileSync('git', ['check-attr', 'binary', '--', 'bin/ffmpeg.zip.001'], { encoding: 'utf8', windowsHide: true })
        assert.strict.equal(attr.trim().endsWith('binary: set'), true, attr)
    })

    it(`should not pack external executables into the npm package, only bin/manifest.json (S1, S5, T1)`, function() {
        //先放誘餌檔(缺忽略規則時確定性變紅): 暫存夾與快取夾內各放一個探針檔, 測試平行執行時他檔之暫存檔亦不得影響本案
        fs.mkdirSync(fdt, { recursive: true })
        fs.writeFileSync(`${fdt}/probe.exe`, 'x')
        fs.mkdirSync(fdDecoy, { recursive: true })
        fs.writeFileSync(`${fdDecoy}/probe.exe`, 'x')
        let r = JSON.parse(execSync('npm pack --dry-run --json', { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }))
        let info = Array.isArray(r) ? r[0] : Object.values(r)[0] //npm 11以前為陣列, npm 12起為以套件名為鍵之物件
        let fps = info.files.map((v) => v.path)
        assert.strict.deepStrictEqual(fps.filter((v) => /\.(exe|dll|msi|zip|7z|\d{3})$/i.test(v)), [])
        assert.strict.deepStrictEqual(fps.filter((v) => v.startsWith('bin/') || v.startsWith('bin-cache/')), ['bin/manifest.json'])
        assert.strict.deepStrictEqual(fps.filter((v) => v.startsWith('src/ffmpeg')), []) //舊路徑檔不入包
        assert.strict.deepStrictEqual(fps.filter((v) => v.startsWith('test/_tmp/') || v.startsWith('sgud/')), [])
    })

})


//規格 D1、E2: 套件端不得自寫下載, 且不得於postinstall下載
describe(`no self-written download in src/ (D1, E2)`, function() {

    let fdSrc = './src'
    let fps = fs.readdirSync(fdSrc).filter((v) => v.endsWith('.mjs')).map((v) => path.join(fdSrc, v))

    it(`should not import fsDownloadFile, fsMergeFiles nor w-zip, and not fetch binaries from the master branch`, function() {
        assert.strict.equal(fps.length > 0, true)
        for (let fp of fps) {
            let c = fs.readFileSync(fp, 'utf8')
            assert.strict.equal(/fsDownloadFile(?!Verify)/.test(c), false, `${fp} imports fsDownloadFile`)
            assert.strict.equal(/fsMergeFiles|w-zip|mZip/.test(c), false, `${fp} assembles or extracts by itself`)
            assert.strict.equal(/raw\/refs\/heads|raw\.githubusercontent\.com|\bfetch\s*\(|https?:\/\/github\.com/.test(c), false, `${fp} downloads by itself`)
        }
    })

    it(`should have removed src/downloadFiles.mjs and scripts/install.mjs`, function() {
        assert.strict.equal(fs.existsSync('src/downloadFiles.mjs'), false)
        assert.strict.equal(fs.existsSync('scripts/install.mjs'), false)
    })

    it(`should not download in postinstall (D1)`, function() {
        let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
        assert.strict.equal(Object.prototype.hasOwnProperty.call(pkg.scripts, 'postinstall'), false)
        assert.strict.equal(Object.prototype.hasOwnProperty.call(pkg.scripts, 'install'), false)
        assert.strict.equal(Object.prototype.hasOwnProperty.call(pkg.scripts, 'preinstall'), false)
    })

    it(`should depend on wsemi 1.9.27 or later, the first version with fsEnsureBins that supports split archives (E4)`, function() {
        let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
        let ver = (s) => String(s).replace(/^[^0-9]*/, '').split('.').map((v) => parseInt(v, 10))
        let atLeast = (a, b) => {
            for (let i = 0; i < 3; i++) {
                if (a[i] !== b[i]) {
                    return a[i] > b[i]
                }
            }
            return true
        }
        assert.strict.equal(atLeast(ver(pkg.dependencies.wsemi), [1, 9, 27]), true, pkg.dependencies.wsemi)
        let fpEnsure = fileURLToPath(import.meta.resolve('wsemi/src/fsEnsureBins.mjs'))
        let installed = JSON.parse(fs.readFileSync(path.join(path.dirname(fpEnsure), '..', 'package.json'), 'utf8')).version
        assert.strict.equal(atLeast(ver(installed), [1, 9, 27]), true, installed)
    })

    it(`should list the node modules needed by fsEnsureBins as external and globals of the UMD build (rollup)`, function() {
        let c = fs.readFileSync('toolg/gDistRollup.mjs', 'utf8')
        let ext = c.slice(c.indexOf('external:'))
        let glb = c.slice(c.indexOf('globals:'), c.indexOf('external:'))
        for (let m of ['url', 'crypto', 'stream', 'stream/promises', 'child_process', 'fs', 'path']) {
            assert.strict.equal(ext.includes(`'${m}'`), true, `external lacks ${m}`)
            assert.strict.equal(glb.includes(`'${m}':`), true, `globals lacks ${m}`)
        }
    })

    it(`should export only the default from the main file and attach ensureBins as its static property (E2)`, function() {
        //具名匯出會使rollup UMD改輸出exports.default, 破壞require('w-ffmpeg')之既有用法
        assert.strict.deepStrictEqual(Object.keys(nsMain), ['default'])
        assert.strict.equal(typeof nsMain.default.ensureBins, 'function')
    })

})
