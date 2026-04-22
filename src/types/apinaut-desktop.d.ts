export {};

declare global {
  interface Window {
    apinautDesktop?: {
      isDesktop: boolean;
      platform: string;
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
    };
  }
}
