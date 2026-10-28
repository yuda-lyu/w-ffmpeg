import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import getFiles from 'w-package-tools/src/getFiles.mjs'


let fdSrc = './src'
let fdTar = './dist'


rollupFiles({
    fns: 'WFfmpeg.mjs',
    fdSrc,
    fdTar,
    // nameDistType: 'kebabCase',
    hookNameDist: () => {
        return 'w-ffmpeg'
    },
    globals: {
        'path': 'path',
        'fs': 'fs',
        'process': 'process',
        'child_process': 'child_process',
        'url': 'url',
        'crypto': 'crypto',
        'stream': 'stream',
        'stream/promises': 'promises',
        'archiver': 'archiver',
        'archiver-zip-encrypted': 'archiver-zip-encrypted',
        'unzipper': 'unzipper',
    },
    external: [
        'path',
        'fs',
        'process',
        'child_process',
        'url',
        'crypto',
        'stream',
        'stream/promises',
        'archiver',
        'archiver-zip-encrypted',
        'unzipper',
    ],
})

