(async () => {
  const styleSheet = `
  body {
    margin: 0;
    background-color: black;
  }

  .strp-ads, .strp-ad-module, .vjs-text-track-display, .vjs-spinner, .vjs-error-display, .vjs-modal-dialog, .vjs-hidden {
    display: none;
  }

  video {
    width: 100%;
    height: 100dvh;
  }
  
  .hulu-pip-controls {
    position: absolute;
    bottom: 5dvh;
    left: 0;
    right: 0;
    display: none;
    gap: 20px;
    width: fit-content;
    margin: 0 auto;
    padding: .8em 1.5em;
    background-color: rgba(10, 10, 10, 0.85);
    border: solid 1px rgba(50, 50, 50, 0.95);
    border-radius: 100dvh;
    backdrop-filter: blur(5px);
  }

  .hulu-pip-controls img {
    cursor: pointer;
    width: 1.2em;
    height: 1.2em;
    opacity: 0.8;
  }
  `;

  // 各要素の取得
  const vjsElem = document.getElementById("vjs_video_3");
  const videoElem = vjsElem.getElementsByTagName("video")[0];
  const parentElem = document.querySelector(".video-core-container");

  // ピクチャー イン ピクチャーをリクエスト
  const pipWindow = await window.documentPictureInPicture.requestWindow({
    width: 640,
    height: 360,
  });

  pipWindow.addEventListener("resize", () => {
    // ToDo: 自動アスペクト比調整
  });

  // pipWindowが閉じられるとき
  pipWindow.document.addEventListener("visibilitychange", () => {
    // p要素の削除
    pElem.remove();
    // vjsElemを元の場所に戻す
    styleElem.remove();
    parentElem.append(vjsElem);
  });
  
  // style要素の作成
  const styleElem = pipWindow.document.createElement("style");
  styleElem.textContent = styleSheet;

  // コントロール要素の作成
  const controlsElem = pipWindow.document.createElement("div");
  controlsElem.classList.add("hulu-pip-controls");
  // ホバー時に表示されるようにする
  pipWindow.document.body.addEventListener("mouseenter", () => { controlsElem.style.display = "flex" });
  pipWindow.document.body.addEventListener("mouseleave", () => { controlsElem.style.display = "none" });
  // 各アイコンの読み込み
  const playIconURL = chrome.runtime.getURL("img/play.png");
  const pauseIconURL = chrome.runtime.getURL("img/pause.png");
  const replay10IconURL = chrome.runtime.getURL("img/replay10.png");
  const forward10IconURL = chrome.runtime.getURL("img/forward10.png");
  // 10秒戻るボタン
  const replay10ButtonElem = pipWindow.document.createElement("img");
  replay10ButtonElem.src = replay10IconURL;
  replay10ButtonElem.addEventListener("click", () => { videoElem.currentTime -= 10 });
  // 10秒進めるボタン
  const forward10ButtonElem = pipWindow.document.createElement("img");
  forward10ButtonElem.src = forward10IconURL;
  forward10ButtonElem.addEventListener("click", () => { videoElem.currentTime += 10 });
  // 再生・一時停止ボタン
  const playButtonElem = pipWindow.document.createElement("img");
  playButtonElem.src = videoElem.paused ? playIconURL : pauseIconURL;
  playButtonElem.addEventListener("click", () => { videoElem.paused ? videoElem.play() : videoElem.pause() });
  videoElem.addEventListener("play", () => { playButtonElem.src = pauseIconURL });
  videoElem.addEventListener("pause", () => { playButtonElem.src = playIconURL });
  // 各ボタンをcontrolsElemに追加
  controlsElem.append(replay10ButtonElem);
  controlsElem.append(playButtonElem);
  controlsElem.append(forward10ButtonElem);

  // 各要素をpipWindowに追加
  pipWindow.document.body.append(styleElem);
  pipWindow.document.body.append(vjsElem);
  pipWindow.document.body.append(controlsElem);

  // 「ピクチャー イン ピクチャーで再生しています」の表示
  const pElem = document.createElement("p");
  pElem.textContent = "ピクチャー イン ピクチャーで再生しています"
  pElem.style.margin = 0;
  pElem.style.padding = "1em 2em";
  parentElem.append(pElem);
})();
