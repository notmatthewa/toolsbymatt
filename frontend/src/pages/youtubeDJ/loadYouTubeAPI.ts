let promise: Promise<void> | null = null;

export function loadYouTubeAPI(): Promise<void> {
  if (promise) return promise;
  if (window.YT?.Player) return Promise.resolve();

  promise = new Promise<void>((resolve) => {
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });

  return promise;
}
