import ensureBins from './ensureBins.mjs'


//fnExe, ffmpeg執行檔名稱
let fnExe = 'ffmpeg.exe'


/**
 * 取得ffmpeg.exe，回傳ffmpeg.exe的絕對路徑
 *
 * 經ensureBins依bin/manifest.json之SHA-256與大小校驗後取得(快取、鏡像、GitHub釘選提交之切割zip分片)，首次使用才下載，安裝時不下載，
 * 離線與內網之用法(W_BIN_CACHE、W_BIN_MIRROR、W_BIN_OFFLINE)見README〈外部執行檔〉
 *
 * 供w-ffmpeg自身與其他依賴w-ffmpeg的套件(例如w-dwload-dlp)調用，無須各自實作偵測與下載邏輯
 *
 * 因ffmpeg.exe只能用於Windows作業系統，故調用前須自行檢核作業系統
 *
 * @deprecated 改用ensureBins(w-ffmpeg/src/ensureBins.mjs，或主檔之WFfmpeg.ensureBins)，本函數保留供舊有深層匯入者相容
 * @returns {Promise} 回傳Promise，resolve回傳執行檔路徑物件，內含fpExe為ffmpeg.exe的絕對路徑字串，reject回傳帶code之Error(E_OFFLINE_MISSING、E_HASH_MISMATCH、E_EXTRACT等)
 * @example
 * import autoDownloadFiles from 'w-ffmpeg/src/autoDownloadFiles.mjs'
 *
 * async function test() {
 *
 *     //autoDownloadFiles, 無快取時自動取得, 取得或校驗失敗則reject
 *     let { fpExe } = await autoDownloadFiles()
 *
 *     console.log('fpExe', fpExe)
 *     // fpExe D:\xxx\node_modules\w-ffmpeg\bin-cache\<sha256>\ffmpeg.exe
 * }
 * test()
 *     .catch((err) => {
 *         console.log('catch', err)
 *     })
 *
 */
async function autoDownloadFiles() {

    //ensureBins, 併發呼叫由其共用同一次取得
    let bins = await ensureBins({ names: fnExe })

    //fpExe
    let fpExe = bins[fnExe]

    return {
        fpExe,
    }
}


export default autoDownloadFiles
