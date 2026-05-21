import fsDownloadFile from 'wsemi/src/fsDownloadFile.mjs'


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

    //逐一下載至fdBase
    for (let fn of fns) {
        let url = `${urlBase}/${fn}`
        let fp = `${fdBase}${fn}`
        console.log(`downloading url[${url}]...`, `to fp[${fp}]`)
        await fsDownloadFile(url, fp)
    }

}


export default downloadFiles
