import path from 'path'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsIsFolder from 'wsemi/src/fsIsFolder.mjs'
import downloadFiles from './downloadFiles.mjs'


//fnExe, ffmpeg執行檔名稱
let fnExe = 'ffmpeg.exe'


//pmDownload, 下載中之Promise, 供併發呼叫共用同一次下載, 避免同時多次下載寫入同一批檔案
let pmDownload = null


/**
 * 自動定位ffmpeg.exe，若無檔案則自動下載，回傳ffmpeg.exe的絕對路徑
 *
 * 依序偵測當前工作路徑的src/與node_modules/w-ffmpeg/src/，皆無ffmpeg.exe時，
 * 代表安裝時npm封鎖scripts致postinstall未執行，故自動調用downloadFiles重新下載
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

    //fdBaseSelf, fdBaseNM, ffmpeg.exe可能所在資料夾(開發套件本身時於cwd的src/, 被安裝為相依套件時於node_modules/w-ffmpeg/src/)
    let fdBaseSelf = `${fdSrv}/src/`
    let fdBaseNM = `${fdSrv}/node_modules/w-ffmpeg/src/`

    //fdBase
    let fdBase = ''
    if (fsIsFile(`${fdBaseSelf}${fnExe}`)) {
        fdBase = fdBaseSelf
    }
    else if (fsIsFile(`${fdBaseNM}${fnExe}`)) {
        fdBase = fdBaseNM
    }
    else {

        //fdBaseDL, 下載落點, 有node_modules/w-ffmpeg/代表為被安裝之相依套件, 否則為套件自身
        let fdBaseDL = fsIsFolder(`${fdSrv}/node_modules/w-ffmpeg/`) ? fdBaseNM : fdBaseSelf

        //downloadFiles, 無ffmpeg.exe代表安裝時npm封鎖scripts致postinstall未執行, 故於此重新執行下載,
        //併發呼叫共用同一個下載Promise, 避免重複下載
        if (pmDownload === null) {
            pmDownload = downloadFiles(fdBaseDL)
                .catch((err) => {

                    //下載失敗歸零, 使下次呼叫可重試下載
                    pmDownload = null

                    return Promise.reject(err)
                })
        }
        await pmDownload

        //check
        if (fsIsFile(`${fdBaseDL}${fnExe}`)) {
            fdBase = fdBaseDL
        }

    }

    //check
    if (fdBase === '') {
        return Promise.reject('can not find ffmpeg.exe')
    }

    //fpExe
    let fpExe = path.resolve(fdBase, fnExe)

    return fpExe
}


export default autoDownloadFiles
