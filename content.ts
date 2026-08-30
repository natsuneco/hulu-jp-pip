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
      overflow: hidden;
    }

    .strp-ads, .strp-ad-module, .vjs-text-track-display, .vjs-spinner, .vjs-error-display, .vjs-modal-dialog, .vjs-hidden {
      display: none;
    }

    video {
      width: 100%;
      height: 100dvh;
    }
    
    .hulu-pip-controls {
      position: fixed;
      bottom: 8px;
      left: 50%;
      display: none;
      align-items: center;
      flex-direction: column;
      gap: 20px;
      width: fit-content;
      margin: 0;
      padding: .8em 1.5em;
      background-color: rgba(10, 10, 10, 0.85);
      border: solid 1px rgba(50, 50, 50, 0.95);
      border-radius: 100dvh;
      backdrop-filter: blur(5px);
      transform: translateX(-50%);
      z-index: 2147483647 !important;
      pointer-events: auto;
      visibility: visible !important;
      opacity: 1 !important;
    }

    .hulu-pip-progress {
      appearance: none;
      flex: 1;
      min-width: 0;
      height: 20px;
      margin: 0;
      background: linear-gradient(
        to right,
        rgba(255, 255, 255, 0.9) var(--hulu-pip-progress, 0%),
        rgba(255, 255, 255, 0.35) var(--hulu-pip-progress, 0%)
      ) center / 100% 3px no-repeat;
      border-radius: 999px;
      cursor: pointer;
    }

    .hulu-pip-progress::-webkit-slider-runnable-track {
      height: 3px;
      background: transparent;
      border-radius: 999px;
    }

    .hulu-pip-progress::-webkit-slider-thumb {
      appearance: none;
      width: 10px;
      height: 10px;
      margin-top: -3.5px;
      background: white;
      border: 0;
      border-radius: 50%;
    }

    .hulu-pip-progress::-moz-range-track {
      height: 3px;
      background: transparent;
      border-radius: 999px;
    }

    .hulu-pip-progress::-moz-range-thumb {
      width: 10px;
      height: 10px;
      background: white;
      border: 0;
      border-radius: 50%;
    }

    .hulu-pip-progress-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: min(70vw, 480px);
    }

    .hulu-pip-time {
      min-width: 78px;
      color: white;
      font-size: .75em;
      text-align: right;
      white-space: nowrap;
    }

    .hulu-pip-control-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      width: 100%;
    }

    .hulu-pip-controls button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
    }

    .hulu-pip-controls img {
      width: 1.2em;
      height: 1.2em;
      opacity: 0.8;
    }

    .hulu-pip-controls button:hover img {
      opacity: 1;
    }

    .hulu-pip-episode-button {
      color: white;
      font-size: 1.2em;
      line-height: 1;
    }

    .hulu-pip-volume {
      appearance: none;
      width: 120px;
      height: 20px;
      margin: 0;
      background: transparent;
      cursor: pointer;
    }

    .hulu-pip-volume::-webkit-slider-runnable-track {
      height: 5px;
      background: rgba(255, 255, 255, 0.55);
      border-radius: 999px;
    }

    .hulu-pip-volume::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      margin-top: -5.5px;
      background: white;
      border: 0;
      border-radius: 50%;
    }

    .hulu-pip-volume::-moz-range-track {
      height: 5px;
      background: rgba(255, 255, 255, 0.55);
      border-radius: 999px;
    }

    .hulu-pip-volume::-moz-range-thumb {
      width: 16px;
      height: 16px;
      background: white;
      border: 0;
      border-radius: 50%;
    }

    .hulu-pip-volume-control {
      display: inline-flex;
      align-items: center;
      gap: .5em;
      color: white;
      font-size: .8em;
      white-space: nowrap;
    }
    `;

    let pipWindow: Window | null = null;

    const observTarget = document.querySelector(".content-main");
    if (!observTarget) {
      return;
    }

    let intervalId: number | null = null;
    let monitorId: number | null = null;

    const observer = new MutationObserver((mutations) => {
      if (!mutations.some((m) => m.type === "childList" && m.addedNodes.length > 0)) {
        return;
      }

      if (intervalId) {
        clearInterval(intervalId);
      }
      let cnt = 0;
      intervalId = setInterval(() => {
        if (mountPiPContent() || cnt++ > 100) {
          clearInterval(intervalId!);
        }
      }, 300);
    });

    observer.observe(observTarget, {
      childList: true,
      subtree: true,
    });

    let vjsElem: HTMLElement | null = null;
    let parentElem: HTMLElement | null = null;
    let pElem: HTMLParagraphElement | null = null;
    let videoElem: HTMLVideoElement | null = null;
    let mountedVjsElem: HTMLElement | null = null;
    let mountedControlsLayerElem: HTMLElement | null = null;
    let preferredVolume: number | null = null;

    const mountPiPContent = () => {
      if (!pipWindow) return false;

      const findVjsElem = (root: ParentNode): Element | undefined =>
        Array.from(root.querySelectorAll("[id^='vjs_video_']")).find(
          (element) => element.querySelector("video"),
        );

      const nextVjsElem =
        findVjsElem(document) ??
        (vjsElem && pipWindow.document.body.contains(vjsElem)
          ? vjsElem
          : findVjsElem(pipWindow.document));
      if (!nextVjsElem) {
        return false;
      }

      const candidateVideoElem = nextVjsElem.querySelector("video");
      if (candidateVideoElem?.tagName !== "VIDEO") {
        return false;
      }

      if (
        mountedVjsElem === nextVjsElem &&
        pipWindow.document.body.contains(nextVjsElem) &&
        videoElem === candidateVideoElem
      ) {
        return true;
      }

      vjsElem = nextVjsElem as HTMLElement;
      videoElem = candidateVideoElem as HTMLVideoElement;

      parentElem = document.querySelector(".video-core-container");
      if (!parentElem) {
        return false;
      }

      if (mountedVjsElem && mountedVjsElem !== nextVjsElem) {
        pipWindow.document.body.replaceChildren();
      }

      mountedControlsLayerElem?.remove();
      pElem?.remove();
      pElem = document.createElement("p");
      pElem.textContent = "ピクチャー イン ピクチャーで再生しています";
      pElem.style.margin = "0";
      pElem.style.padding = "1em 2em";

      const controlsElem = pipWindow.document.createElement("div");
      controlsElem.classList.add("hulu-pip-controls");
      controlsElem.style.setProperty("position", "fixed", "important");
      controlsElem.style.setProperty("left", "50%", "important");
      controlsElem.style.setProperty("bottom", "8px", "important");
      controlsElem.style.setProperty("z-index", "2147483647", "important");
      controlsElem.style.setProperty("visibility", "visible", "important");
      controlsElem.style.setProperty("opacity", "1", "important");

      pipWindow.document.body.addEventListener("mouseenter", () => {
        controlsElem.style.display = "flex";
      });
      pipWindow.document.body.addEventListener("mouseleave", () => {
        controlsElem.style.display = "none";
      });

      const controlsLayerElem = pipWindow.document.createElement("div");
      controlsLayerElem.style.setProperty("position", "fixed", "important");
      controlsLayerElem.style.setProperty("inset", "0", "important");
      controlsLayerElem.style.setProperty("z-index", "2147483647", "important");
      controlsLayerElem.style.setProperty("pointer-events", "none", "important");

      const getVideoElem = (): HTMLVideoElement | null => {
        if (videoElem?.isConnected) {
          return videoElem;
        }

        const currentVideoElem = pipWindow?.document.querySelector("video");
        return currentVideoElem?.tagName === "VIDEO"
          ? currentVideoElem as HTMLVideoElement
          : null;
      };

      const seekBy = (seconds: number): void => {
        const currentVideoElem = getVideoElem();
        if (!currentVideoElem || !Number.isFinite(currentVideoElem.currentTime)) {
          return;
        }

        const duration = Number.isFinite(currentVideoElem.duration)
          ? currentVideoElem.duration
          : Number.POSITIVE_INFINITY;
        currentVideoElem.currentTime = Math.min(
          Math.max(currentVideoElem.currentTime + seconds, 0),
          duration,
        );
      };

      const createIconButton = (
        iconURL: string,
        label: string,
        onClick: () => void,
      ): HTMLButtonElement => {
        const buttonElem = pipWindow!.document.createElement("button");
        buttonElem.type = "button";
        buttonElem.setAttribute("aria-label", label);

        const iconElem = pipWindow!.document.createElement("img");
        iconElem.src = iconURL;
        iconElem.alt = "";
        buttonElem.append(iconElem);
        buttonElem.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        });

        return buttonElem;
      };

      const createTextButton = (
        symbol: string,
        label: string,
        onClick: () => void,
      ): HTMLButtonElement => {
        const buttonElem = pipWindow!.document.createElement("button");
        buttonElem.type = "button";
        buttonElem.className = "hulu-pip-episode-button";
        buttonElem.setAttribute("aria-label", label);
        buttonElem.textContent = symbol;
        buttonElem.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        });

        return buttonElem;
      };

      const clickNativePlayerButton = (label: string): void => {
        const findButton = (
          root: ParentNode | null | undefined,
          skipCustomControls = false,
        ): Element | undefined =>
          Array.from(root?.querySelectorAll("button, [role='button']") ?? []).find(
            (button) => {
              if (skipCustomControls && button.closest(".hulu-pip-controls")) {
                return false;
              }

              const buttonLabel = [
                button.getAttribute("aria-label"),
                button.getAttribute("title"),
                button.textContent,
              ]
                .filter((value): value is string => value !== null)
                .join(" ");
              return buttonLabel.includes(label);
            },
          );

        const nativeButton =
          findButton(document) ??
          findButton(vjsElem) ??
          findButton(pipWindow?.document, true);

        if (nativeButton && "click" in nativeButton) {
          (nativeButton as Element & { click: () => void }).click();
        }
      };

      const playIconURL = chrome.runtime.getURL("img/play.png");
      const pauseIconURL = chrome.runtime.getURL("img/pause.png");
      const replay10IconURL = chrome.runtime.getURL("img/replay10.png");
      const forward10IconURL = chrome.runtime.getURL("img/forward10.png");

      const replay10ButtonElem = createIconButton(
        replay10IconURL,
        "１０秒戻る",
        () => seekBy(-10),
      );
      const forward10ButtonElem = createIconButton(
        forward10IconURL,
        "１０秒進む",
        () => seekBy(10),
      );
      const previousEpisodeButtonElem = createTextButton(
        "⏮",
        "前の動画",
        () => clickNativePlayerButton("前の動画"),
      );
      const nextEpisodeButtonElem = createTextButton(
        "⏭",
        "次の動画",
        () => clickNativePlayerButton("次の動画"),
      );
      const playButtonElem = createIconButton(
        videoElem.paused ? playIconURL : pauseIconURL,
        videoElem.paused ? "再生" : "一時停止",
        () => {
          const currentVideoElem = getVideoElem();
          if (!currentVideoElem) return;

          if (currentVideoElem.paused) {
            void currentVideoElem.play();
          } else {
            currentVideoElem.pause();
          }
        },
      );

      const volumeElem = pipWindow.document.createElement("input");
      volumeElem.className = "hulu-pip-volume";
      volumeElem.type = "range";
      volumeElem.min = "0";
      volumeElem.max = "1";
      volumeElem.step = "0.01";
      if (preferredVolume === null) {
        preferredVolume = videoElem.muted ? 0 : videoElem.volume;
      } else {
        videoElem.volume = preferredVolume;
        videoElem.muted = preferredVolume === 0;
      }
      volumeElem.value = String(preferredVolume);
      volumeElem.title = "音量";
      volumeElem.setAttribute("aria-label", "音量");

      const volumeControlElem = pipWindow.document.createElement("div");
      volumeControlElem.className = "hulu-pip-volume-control";
      volumeControlElem.append(volumeElem);

      const volumeValueElem = pipWindow.document.createElement("output");
      volumeValueElem.textContent = `${Math.round(Number(volumeElem.value) * 100)}%`;
      volumeValueElem.setAttribute("aria-live", "polite");
      volumeControlElem.append(volumeValueElem);

      const progressElem = pipWindow.document.createElement("input");
      progressElem.className = "hulu-pip-progress";
      progressElem.type = "range";
      progressElem.min = "0";
      progressElem.max = "1";
      progressElem.step = "0.1";
      progressElem.value = String(videoElem.currentTime || 0);
      progressElem.setAttribute("aria-label", "再生位置");

      const progressTimeElem = pipWindow.document.createElement("output");
      progressTimeElem.className = "hulu-pip-time";
      progressTimeElem.setAttribute("aria-live", "polite");

      const progressRowElem = pipWindow.document.createElement("div");
      progressRowElem.className = "hulu-pip-progress-row";
      progressRowElem.append(progressElem);
      progressRowElem.append(progressTimeElem);

      const formatTime = (totalSeconds: number): string => {
        if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
          return "--:--";
        }

        const roundedSeconds = Math.floor(totalSeconds);
        const hours = Math.floor(roundedSeconds / 3600);
        const minutes = Math.floor((roundedSeconds % 3600) / 60);
        const seconds = roundedSeconds % 60;
        if (hours > 0) {
          return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }

        return `${minutes}:${String(seconds).padStart(2, "0")}`;
      };

      const syncProgress = (): void => {
        const currentVideoElem = getVideoElem();
        if (!currentVideoElem) return;

        const duration = Number.isFinite(currentVideoElem.duration) && currentVideoElem.duration > 0
          ? currentVideoElem.duration
          : 1;
        const currentTime = Number.isFinite(currentVideoElem.currentTime)
          ? Math.min(Math.max(currentVideoElem.currentTime, 0), duration)
          : 0;
        progressElem.max = String(duration);
        progressElem.value = String(currentTime);
        progressElem.style.setProperty(
          "--hulu-pip-progress",
          `${(currentTime / duration) * 100}%`,
        );
        progressTimeElem.textContent = `${formatTime(currentTime)} / ${formatTime(currentVideoElem.duration)}`;
      };

      progressElem.addEventListener("input", (event) => {
        event.stopPropagation();
        const currentVideoElem = getVideoElem();
        const nextTime = Number(progressElem.value);
        if (!currentVideoElem || !Number.isFinite(nextTime)) return;

        try {
          currentVideoElem.currentTime = nextTime;
        } catch {
          return;
        }
        syncProgress();
      });

      volumeElem.addEventListener("input", (event) => {
        event.stopPropagation();
        const currentVideoElem = getVideoElem();
        if (!currentVideoElem) return;

        preferredVolume = Number(volumeElem.value);
        currentVideoElem.volume = preferredVolume;
        if (currentVideoElem.volume > 0) {
          currentVideoElem.muted = false;
        }
        volumeValueElem.textContent = `${Math.round(currentVideoElem.volume * 100)}%`;
      });

      videoElem.addEventListener("play", () => {
        playButtonElem.querySelector("img")?.setAttribute("src", pauseIconURL);
      });
      videoElem.addEventListener("pause", () => {
        playButtonElem.querySelector("img")?.setAttribute("src", playIconURL);
      });

      videoElem.addEventListener("volumechange", () => {
        volumeElem.value = String(videoElem!.muted ? 0 : videoElem!.volume);
        volumeValueElem.textContent = `${Math.round(Number(volumeElem.value) * 100)}%`;
      });

      videoElem.addEventListener("timeupdate", syncProgress);
      videoElem.addEventListener("durationchange", syncProgress);
      videoElem.addEventListener("loadedmetadata", syncProgress);
      syncProgress();

      const controlRowElem = pipWindow.document.createElement("div");
      controlRowElem.className = "hulu-pip-control-row";
      controlRowElem.append(previousEpisodeButtonElem);
      controlRowElem.append(replay10ButtonElem);
      controlRowElem.append(playButtonElem);
      controlRowElem.append(forward10ButtonElem);
      controlRowElem.append(nextEpisodeButtonElem);
      controlRowElem.append(volumeControlElem);
      controlsElem.append(progressRowElem);
      controlsElem.append(controlRowElem);
      controlsLayerElem.append(controlsElem);

      pipWindow.document.body.append(vjsElem);
      pipWindow.document.body.append(controlsLayerElem);
      mountedVjsElem = vjsElem;
      mountedControlsLayerElem = controlsLayerElem;
      pElem.textContent = "ピクチャー イン ピクチャーで再生しています";
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

    let cnt = 0;
    intervalId = setInterval(() => {
      if (mountPiPContent() || cnt++ > 100) {
        clearInterval(intervalId!);
      }
    }, 300);
    monitorId = setInterval(() => {
      mountPiPContent();
    }, 500);

    pipWindow.document.addEventListener("visibilitychange", () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (monitorId) {
        clearInterval(monitorId);
      }
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
