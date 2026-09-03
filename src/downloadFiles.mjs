import path from 'path'
import fsDownloadFile from 'wsemi/src/fsDownloadFile.mjs'
import fsRenameFile from 'wsemi/src/fsRenameFile.mjs'
import fsDeleteFile from 'wsemi/src/fsDeleteFile.mjs'
import fsDeleteFolder from 'wsemi/src/fsDeleteFolder.mjs'
import fsMergeFiles from 'wsemi/src/fsMergeFiles.mjs'
import mZip from 'w-zip/src/mZip.mjs'


async function downloadFiles(fdBase) {

    //urlBase, GitHub raw (master HEAD), 須確保各切割zip檔已commit在master
    let urlBase = `https://github.com/yuda-lyu/w-ffmpeg/raw/refs/heads/master/src`

    //fns, ffmpeg.exe切割後的各分片zip檔
    let fns = [
        'ffmpeg.zip.001',
        'ffmpeg.zip.002',
        'ffmpeg.zip.003',
        'ffmpeg.zip.004',
        'ffmpeg.zip.005',
    ]

    //fps, 各分片zip檔於fdBase的絕對路徑
    let fps = fns.map((fn) => {
        return path.resolve(fdBase, fn)
    })

    //逐一下載至fdBase
    for (let fn of fns) {
        let url = `${urlBase}/${fn}`
        let fp = path.resolve(fdBase, fn)
        console.log(`downloading url[${url}]...`, `to fp[${fp}]`)
        await fsDownloadFile(url, fp)
    }

    //合併分片 → ffmpeg.zip
    let zipFfmpeg = path.resolve(fdBase, 'ffmpeg.zip')
    await fsMergeFiles(fps, zipFfmpeg)

    //解壓縮 → temp/ffmpeg.exe (zip根目錄即含ffmpeg.exe)
    let fdTemp = path.resolve(fdBase, 'temp')
    await mZip.unzip(zipFfmpeg, fdTemp)

    //搬移 temp/ffmpeg.exe → src/ffmpeg.exe
    let fpExeTemp = path.resolve(fdTemp, 'ffmpeg.exe')
    let fpExe = path.resolve(fdBase, 'ffmpeg.exe')
    fsRenameFile(fpExeTemp, fpExe)

    //清理: 合併zip + temp資料夾 + 各分片zip (避免node_modules殘留)
    fsDeleteFile(zipFfmpeg)
    fsDeleteFolder(fdTemp)
    for (let fp of fps) {
        fsDeleteFile(fp)
    }

}


export default downloadFiles
