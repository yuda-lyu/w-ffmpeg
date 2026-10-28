import process from 'process'
import get from 'lodash-es/get.js'
import isearr from 'wsemi/src/isearr.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import execProcess from 'wsemi/src/execProcess.mjs'
import ensureBins from './ensureBins.mjs'


//fnExe, ffmpeg執行檔名稱
let fnExe = 'ffmpeg.exe'


function isWindows() {
    return process.platform === 'win32'
}


/**
 * 調用ffmpeg，傳入參數交由套件自帶的ffmpeg.exe執行，只能用於Windows作業系統
 *
 * ffmpeg.exe不含於npm包，首次調用時經ensureBins依bin/manifest.json自GitHub(釘選提交)下載切割zip分片，
 * 以SHA-256與大小校驗後組合、解壓並存於快取(預設為套件根之bin-cache/)，之後自快取取得(亦校驗)，安裝時不下載
 *
 * 離線與內網之用法(環境變數W_BIN_CACHE、W_BIN_MIRROR、W_BIN_OFFLINE)見README〈外部執行檔〉，
 * 部署前可預先調用WFfmpeg.ensureBins()取得
 *
 * ffmpeg: https://ffmpeg.org/
 *
 * @param {Array|String} args 輸入ffmpeg參數，可為陣列(例如['-i','./input.mp4','./output.avi'])或字串
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Function} [opt.cbStdout=null] 輸入回調stdout函數，預設null
 * @param {Function} [opt.cbStderr=null] 輸入回調stderr函數，預設null
 * @param {Number} [opt.timeout=null] 輸入逾時毫秒數，預設null表示不限制
 * @param {String} [opt.codeCmd] 輸入讀回程序stdout與stderr回應的解碼字串，預設由execProcess決定
 * @param {String} [opt.mode] 輸入子程序執行模式(spawn/exec/execFile)，預設由execProcess決定為spawn
 * @returns {Promise} 回傳Promise，resolve回傳成功訊息，reject回傳錯誤訊息(字串，取不到ffmpeg.exe時為`[錯誤碼] 說明`，錯誤碼如E_OFFLINE_MISSING、E_HASH_MISMATCH)
 * @example
 * import WFfmpeg from './src/WFfmpeg.mjs'
 *
 * async function test() {
 *
 *     //args, 轉檔範例: 將input.mp4轉為output.avi
 *     let args = ['-i', './input.mp4', './output.avi']
 *
 *     //cbStderr, ffmpeg的進度與資訊預設輸出至stderr
 *     let cbStderr = (msg) => {
 *         console.log(msg)
 *     }
 *
 *     //WFfmpeg
 *     await WFfmpeg(args, { cbStderr })
 *
 *     console.log('done')
 * }
 * test()
 *     .catch((err) => {
 *         console.log('catch', err)
 *     })
 *
 */
async function WFfmpeg(args, opt = {}) {

    //isWindows
    if (!isWindows()) {
        return Promise.reject('operating system is not windows')
    }

    //check
    if (!isearr(args) && !isestr(args)) {
        return Promise.reject('args is not an effective array or string')
    }

    //fpExe, 經ensureBins取得ffmpeg.exe(快取、鏡像或GitHub, 皆依清單校驗), 取不到時維持既有之字串型態reject, 以`[錯誤碼] 說明`呈現
    let fpExe = ''
    try {
        let bins = await ensureBins({ names: fnExe })
        fpExe = bins[fnExe]
    }
    catch (err) {
        return Promise.reject(`[${get(err, 'code', 'E_ENSURE_BINS')}] ${get(err, 'message', String(err))}`)
    }

    //opt for execProcess (未提供者交由execProcess採用預設)
    let cbStdout = get(opt, 'cbStdout')
    let cbStderr = get(opt, 'cbStderr')
    let timeout = get(opt, 'timeout')
    let codeCmd = get(opt, 'codeCmd')
    let mode = get(opt, 'mode')

    //execProcess
    return await execProcess(fpExe, args, { cbStdout, cbStderr, timeout, codeCmd, mode })
}


//ensureBins, 部署前預先取得ffmpeg.exe, 以靜態屬性掛於主函數(主檔為default匯出, 不加具名匯出)
WFfmpeg.ensureBins = ensureBins


export default WFfmpeg
