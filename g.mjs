import fs from 'fs'
import WFfmpeg from './src/WFfmpeg.mjs'


async function test() {

    //fpIn, 輸入視訊檔
    let fpIn = './test/aigen.mp4'

    //fpOut, 輸出音訊檔
    let fpOut = './test/aigen.mp3'

    //args, 自aigen.mp4提取音訊輸出為aigen.mp3 (-y覆蓋既有檔, -vn去除視訊軌)
    let args = ['-y', '-i', fpIn, '-vn', fpOut]

    //cbStdout
    let cbStdout = (msg) => {
        console.log(msg)
    }

    //cbStderr, ffmpeg的轉檔進度與資訊預設輸出至stderr
    let cbStderr = (msg) => {
        console.log(msg)
    }

    //WFfmpeg
    await WFfmpeg(args, { cbStdout, cbStderr })

    //len
    let len = fs.statSync(fpOut).size
    console.log('len', len)

    //unlinkSync
    fs.unlinkSync(fpOut)

    console.log('done')
}
test()
    .catch((err) => {
        console.log('catch', err)
    })
// len 65102
// done


//node g.mjs
