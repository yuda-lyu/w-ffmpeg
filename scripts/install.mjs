import path from 'path'
import { fileURLToPath } from 'url'
import fsRenameFile from 'wsemi/src/fsRenameFile.mjs'
import fsDeleteFile from 'wsemi/src/fsDeleteFile.mjs'
import fsDeleteFolder from 'wsemi/src/fsDeleteFolder.mjs'
import fsMergeFiles from 'wsemi/src/fsMergeFiles.mjs'
import mZip from 'w-zip/src/mZip.mjs'
import downloadFiles from '../src/downloadFiles.mjs'


async function init() {

    //check, 被安裝為相依套件時才執行 (位於node_modules內)
    let __dirname = path.dirname(fileURLToPath(import.meta.url))
    if (!__dirname.includes('node_modules')) {
        return //非位於node_modules, 代表開發套件本身, 不下載
    }

    //fdSrv, postinstall時cwd=套件自身在node_modules內的目錄
    let fdSrv = path.resolve()

    //fdBase, 對應ffmpeg.exe所在資料夾(src/)
    let fdBase = `${fdSrv}/src/`

    //1) 下載各切割zip檔至fdBase
    await downloadFiles(fdBase)

    //2) 合併分片 → ffmpeg.zip
    let zipFfmpeg = path.resolve(fdBase, 'ffmpeg.zip')
    let fps = [
        path.resolve(fdBase, 'ffmpeg.zip.001'),
        path.resolve(fdBase, 'ffmpeg.zip.002'),
        path.resolve(fdBase, 'ffmpeg.zip.003'),
        path.resolve(fdBase, 'ffmpeg.zip.004'),
        path.resolve(fdBase, 'ffmpeg.zip.005'),
    ]
    await fsMergeFiles(fps, zipFfmpeg)

    //3) 解壓縮 → temp/ffmpeg.exe (zip根目錄即含ffmpeg.exe)
    let fdTemp = path.resolve(fdBase, 'temp')
    await mZip.unzip(zipFfmpeg, fdTemp)

    //4) 搬移 temp/ffmpeg.exe → src/ffmpeg.exe
    let fpExeTemp = path.resolve(fdTemp, 'ffmpeg.exe')
    let fpExe = path.resolve(fdBase, 'ffmpeg.exe')
    fsRenameFile(fpExeTemp, fpExe)

    //5) 清理: 合併zip + temp資料夾 + 各分片zip (避免node_modules殘留)
    fsDeleteFile(zipFfmpeg)
    fsDeleteFolder(fdTemp)
    for (let fp of fps) {
        fsDeleteFile(fp)
    }

}
init()
    .catch((err) => {
        console.log(err)
    })

//node scripts/install.mjs
