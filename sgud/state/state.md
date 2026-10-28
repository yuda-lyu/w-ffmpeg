# 狀態

本檔記 w-ffmpeg 各功能之**現況**(做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證之版本);只記現況、不寫過程(過程見 `sgud/exp/experience.md`).

本檔 2026-10-28 新建.

## 調用 ffmpeg `WFfmpeg`

- 現況: 已實作(僅 Windows):`src/WFfmpeg.mjs` 把參數交由 `ffmpeg.exe` 執行(`execProcess`),可回調 stdout/stderr、逾時、解碼與執行模式.UMD `dist/w-ffmpeg.umd.js` 為 `module.exports = 函數`.
- 測試: `test/WFfmpeg.test.mjs`(自 `aigen.mp4` 提取 mp3;`ffmpeg.exe` 經本機鏡像離線取得,不連外網).

## 外部執行檔 ffmpeg.exe 之取得(R-BIN-EXE-01)

- 現況: 已依制式規格 `外部執行檔之存放下載校驗與離線.md`(dspec)改造為 B 類釘選模式(bin-ffmpeg,2026-10-28;package.json version 1.0.28 之工作樹,未發布):`bin/manifest.json`(commit `5b4a261bac98f2beaf1f18ae63b6e17ee96c8673`;`parts`＝`bin/ffmpeg.zip.001`~`.005`、`assembled`、`extract`＝`ffmpeg.exe`)、`src/ensureBins.mjs`(轉呼叫 wsemi 1.9.27 `fsEnsureBins`)、`toolg/genBinManifest.mjs`;`WFfmpeg` 直接經 `ensureBins` 取得路徑(取不到時仍以字串 reject,`[code] message`);`src/autoDownloadFiles.mjs` 保留對外深層匯入點(回 `{ fpExe }`,`@deprecated`,reject 改為帶 code 之 Error);`WFfmpeg.ensureBins` 供部署前預先取得;README〈外部執行檔〉已寫.已刪 `src/downloadFiles.mjs`、`scripts/install.mjs` 與 `postinstall`;舊路徑 `src/ffmpeg.zip.001`~`.005` 保留於 repo(舊版相容 S2,不入 npm 包).
- 規則: `sgud/rule/rulebook.md` R-BIN-EXE-01.
- 測試: `test/unit-binManifest.test.mjs`(M1/M2/M4、T1、T2、清單提交位元組、S2、D1/E2、wsemi 版本、gDistRollup external/globals、主檔匯出形態)、`test/api-ensureBins.test.mjs`(T3~T7、環境變數、O4、預設快取與 cwd 無關、不轉傳 floatingManifestUrl、`autoDownloadFiles` 與 `WFfmpeg` 之全域 fetch 攔截;本機 HTTP 127.0.0.1:8971)、`test/WFfmpeg.test.mjs`.T8 不適用(非主幹模式).
- 驗證(bin-ffmpeg,2026-10-28 最終碼): 見主控任務 20261028054319 `agent-out/bin-ffmpeg-修正報告.md`(修前紅、修後全套、變異、UMD 重建實跑、`npm pack --dry-run`、`scan-bins`).未經第三方外審(本輪未列外審).
- 待辦: 主控發布新版(含 `dist` 重建);舊版淘汰後移除 `src/ffmpeg.zip.001`~`.005`(另案);下游 w-dwload-dlp 之測試 `test/unit-ensureDlpExe.test.mjs` 以假檔放在 `node_modules/w-ffmpeg/src/ffmpeg.exe`,升版後依舊路徑查找者須改用 `WFfmpeg.ensureBins()`(由主控連動時通報).
- 已知限制: 見 R-BIN-EXE-01〈已知限制〉.
