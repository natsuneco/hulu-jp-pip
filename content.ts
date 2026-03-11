(() => {
  const MIN_CHROME_VERSION = 116;

  const getChromiumMajorVersion = (): number | null => {
    const userAgent = navigator.userAgent;
    const edgeMatch = userAgent.match(/Edg\/(\d+)\./);
    if (edgeMatch) {
      return Number.parseInt(edgeMatch[1], 10);
    }

    const chromeMatch = userAgent.match(/Chrome\/(\d+)\./);
    if (chromeMatch) {
      return Number.parseInt(chromeMatch[1], 10);
    }

    return null;
  };

  const ensureDocumentPiPSupported = (): boolean => {
    const majorVersion = getChromiumMajorVersion();
    const isVersionSupported =
      majorVersion !== null && majorVersion >= MIN_CHROME_VERSION;

    if (!window.documentPictureInPicture || !isVersionSupported) {
      return false;
    }

    return true;
  };

  const startHuluPiP = async () => {
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

    let pipWindow: Window | null = null;

    const observTarget = document.querySelector(".content-main");
    if (!(observTarget instanceof HTMLElement)) {
      return;
    }

    let intervalId: number | null = null;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList" && m.removedNodes.length > 0) {
          pipWindow?.document.body.replaceChildren();
        } else if (m.type === "childList" && m.addedNodes.length > 0) {
          if (intervalId) {
            clearInterval(intervalId);
          }
          let cnt = 0;
          intervalId = setInterval(() => {
            if (mountPiPContent() || cnt++ > 100) {
              clearInterval(intervalId!);
            }
          }, 300);
        }
      }
    });

    observer.observe(observTarget, {
      childList: true,
    });

    let vjsElem: HTMLElement | null = null;
    let parentElem: HTMLElement | null = null;
    let pElem: HTMLParagraphElement | null = null;

    const mountPiPContent = () => {
      if (!pipWindow) return false;

      vjsElem = document.querySelector("[id^='vjs_video_']");
      if (!(vjsElem instanceof HTMLElement)) {
        return false;
      }

      const videoElem = vjsElem.querySelector("video");
      if (!(videoElem instanceof HTMLVideoElement) || videoElem.src === "") {
        return false;
      }

      parentElem = document.querySelector(".video-core-container");
      if (!(parentElem instanceof HTMLElement)) {
        return false;
      }

      pElem = document.createElement("p");
      pElem.textContent = "ピクチャー イン ピクチャーで再生しています";
      pElem.style.margin = "0";
      pElem.style.padding = "1em 2em";

      const controlsElem = pipWindow.document.createElement("div");
      controlsElem.classList.add("hulu-pip-controls");
      pipWindow.document.body.addEventListener("mouseenter", () => {
        controlsElem.style.display = "flex";
      });
      pipWindow.document.body.addEventListener("mouseleave", () => {
        controlsElem.style.display = "none";
      });

      const playIconURL = chrome.runtime.getURL("img/play.png");
      const pauseIconURL = chrome.runtime.getURL("img/pause.png");
      const replay10IconURL = chrome.runtime.getURL("img/replay10.png");
      const forward10IconURL = chrome.runtime.getURL("img/forward10.png");

      const replay10ButtonElem = pipWindow.document.createElement("img");
      replay10ButtonElem.src = replay10IconURL;
      replay10ButtonElem.addEventListener("click", () => {
        videoElem.currentTime -= 10;
      });

      const forward10ButtonElem = pipWindow.document.createElement("img");
      forward10ButtonElem.src = forward10IconURL;
      forward10ButtonElem.addEventListener("click", () => {
        videoElem.currentTime += 10;
      });

      const playButtonElem = pipWindow.document.createElement("img");
      playButtonElem.src = videoElem.paused ? playIconURL : pauseIconURL;
      playButtonElem.addEventListener("click", () => {
        if (videoElem.paused) {
          videoElem.play();
        } else {
          videoElem.pause();
        }
      });
      videoElem.addEventListener("play", () => {
        playButtonElem.src = pauseIconURL;
      });
      videoElem.addEventListener("pause", () => {
        playButtonElem.src = playIconURL;
      });

      controlsElem.append(replay10ButtonElem);
      controlsElem.append(playButtonElem);
      controlsElem.append(forward10ButtonElem);

      pipWindow.document.body.append(vjsElem);
      pipWindow.document.body.append(controlsElem);
      
      parentElem?.append(pElem);

      return true;
    }

    pipWindow = await window.documentPictureInPicture.requestWindow({
      width: 640,
      height: 360,
    });

    
    const styleElem = pipWindow.document.createElement("style");
    styleElem.textContent = styleSheet;
    pipWindow.document.head.append(styleElem);

    mountPiPContent();

    pipWindow.document.addEventListener("visibilitychange", () => {
      pElem?.remove();
      parentElem?.append(vjsElem!);
      observer.disconnect();
    });
  };

  if (ensureDocumentPiPSupported()) {
    startHuluPiP();
  } else {
    alert(`この機能は Chromium ${MIN_CHROME_VERSION} 以降で利用できます。ブラウザを最新版へ更新してください。`);
  }
})();
