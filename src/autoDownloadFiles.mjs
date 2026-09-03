import path from 'path'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import downloadFiles from './downloadFiles.mjs'


/**
 * 自動定位ffmpeg.exe，若無檔案則自動下載，回傳ffmpeg.exe的絕對路徑
 *
 * 依序偵測當前工作路徑的src/與node_modules/w-ffmpeg/src/，皆無ffmpeg.exe時，
 * 代表安裝時npm封鎖scripts致postinstall未執行，故自動調用downloadFiles重新下載，落點為node_modules/w-ffmpeg/src/
 *
 * 供w-ffmpeg自身與其他依賴w-ffmpeg的套件(例如w-dwload-dlp)調用，無須各自實作偵測與下載邏輯
 *
 * 因ffmpeg.exe只能用於Windows作業系統，故調用前須自行檢核作業系統
 *
 * @returns {Promise} 回傳Promise，resolve回傳ffmpeg.exe的絕對路徑字串，reject回傳錯誤訊息
 * @example
 * import autoDownloadFiles from 'w-ffmpeg/src/autoDownloadFiles.mjs'
 *
 * async function test() {
 *
 *     //autoDownloadFiles, 無ffmpeg.exe時自動下載, 下載失敗則reject
 *     let fpExeFfmpeg = await autoDownloadFiles()
 *
 *     console.log('fpExeFfmpeg', fpExeFfmpeg)
 *     // fpExeFfmpeg D:\xxx\node_modules\w-ffmpeg\src\ffmpeg.exe
 * }
 * test()
 *     .catch((err) => {
 *         console.log('catch', err)
 *     })
 *
 */
async function autoDownloadFiles() {

    //fdSrv, 於調用時取當前工作路徑
    let fdSrv = path.resolve()

    //fnExe
    let fnExe = 'ffmpeg.exe'

    //fdExeSrc, fdExeNM, ffmpeg.exe可能所在資料夾(開發套件本身時於cwd的src/, 被安裝為相依套件時於node_modules/w-ffmpeg/src/)
    let fdExeSrc = `${fdSrv}/src/`
    let fdExeNM = `${fdSrv}/node_modules/w-ffmpeg/src/`

    //fdExe
    let fdExe = ''
    if (fsIsFile(`${fdExeSrc}${fnExe}`)) {
        fdExe = fdExeSrc
    }
    else if (fsIsFile(`${fdExeNM}${fnExe}`)) {
        fdExe = fdExeNM
    }
    else {

        //downloadFiles, 無ffmpeg.exe代表安裝時npm封鎖scripts致postinstall未執行,
        //故於此重新執行下載, 落點為本套件於node_modules內的src/
        await downloadFiles(fdExeNM)
        if (fsIsFile(`${fdExeNM}${fnExe}`)) {
            fdExe = fdExeNM
        }

    }

    //check
    if (fdExe === '') {
        return Promise.reject('can not find ffmpeg.exe')
    }

    //fpExe
    let fpExe = path.resolve(fdExe, fnExe)

    return fpExe
}


export default autoDownloadFiles
