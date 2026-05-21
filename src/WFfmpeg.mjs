import path from 'path'
import process from 'process'
import get from 'lodash-es/get.js'
import isearr from 'wsemi/src/isearr.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import execProcess from 'wsemi/src/execProcess.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'


let fdSrv = path.resolve()


function isWindows() {
    return process.platform === 'win32'
}


/**
 * 調用ffmpeg，傳入參數交由套件自帶的ffmpeg.exe執行，只能用於Windows作業系統
 *
 * ffmpeg.exe由安裝時(postinstall)自GitHub下載切割zip分片合併解壓而來，位於套件src/目錄
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
 * @returns {Promise} 回傳Promise，resolve回傳成功訊息，reject回傳錯誤訊息
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

    //fnExe
    let fnExe = 'ffmpeg.exe'

    //fdExe, 定位ffmpeg.exe (開發時於cwd的src/, 被安裝為相依套件時於node_modules/w-ffmpeg/src/)
    let fdExe = ''
    if (true) {
        let fdExeSrc = `${fdSrv}/src/`
        let fdExeNM = `${fdSrv}/node_modules/w-ffmpeg/src/`
        if (fsIsFile(`${fdExeSrc}${fnExe}`)) {
            fdExe = fdExeSrc
        }
        else if (fsIsFile(`${fdExeNM}${fnExe}`)) {
            fdExe = fdExeNM
        }
        else {
            return Promise.reject('can not find ffmpeg.exe, the postinstall download may have failed')
        }
    }

    //fpExe
    let fpExe = path.resolve(fdExe, fnExe)

    //opt for execProcess (未提供者交由execProcess採用預設)
    let cbStdout = get(opt, 'cbStdout')
    let cbStderr = get(opt, 'cbStderr')
    let timeout = get(opt, 'timeout')
    let codeCmd = get(opt, 'codeCmd')
    let mode = get(opt, 'mode')

    //execProcess
    return await execProcess(fpExe, args, { cbStdout, cbStderr, timeout, codeCmd, mode })
}


export default WFfmpeg
