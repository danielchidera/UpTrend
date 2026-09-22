import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./ResponsivePreview.css";

const DEVICE_PRESETS = [
  {
    id: "phone",
    label: "Phone",
    shortLabel: "📱 Phone",
    width: 390,
    height: 844,
  },
  {
    id: "large-phone",
    label: "Large Phone",
    shortLabel: "📱 Large",
    width: 430,
    height: 932,
  },
  {
    id: "laptop",
    label: "Laptop",
    shortLabel: "💻 Laptop",
    width: 1366,
    height: 768,
  },
  {
    id: "large-laptop",
    label: "Large Laptop",
    shortLabel: "💻 Large Laptop",
    width: 1440,
    height: 900,
  },
  {
    id: "desktop",
    label: "Desktop",
    shortLabel: "🖥 Desktop",
    width: 1920,
    height: 1080,
  },
  {
    id: "large-desktop",
    label: "Large Desktop",
    shortLabel: "🖥 Large Desktop",
    width: 2560,
    height: 1440,
  },
];

function getInitialPreset() {
  try {
    const saved = sessionStorage.getItem(
      "uptrend_responsive_preview_device"
    );

    if (
      saved &&
      DEVICE_PRESETS.some(
        (device) => device.id === saved
      )
    ) {
      return saved;
    }
  } catch {}

  return "laptop";
}

function ResponsivePreview() {
  const [selectedId, setSelectedId] =
    useState(getInitialPreset);

  const [reloadKey, setReloadKey] = useState(0);
  const [scale, setScale] = useState(1);

  const stageRef = useRef(null);

  const selectedDevice = useMemo(
    () =>
      DEVICE_PRESETS.find(
        (device) => device.id === selectedId
      ) || DEVICE_PRESETS[2],
    [selectedId]
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "uptrend_responsive_preview_device",
        selectedId
      );
    } catch {}
  }, [selectedId]);

  /*
   * =========================================================
   * AUTOMATIC FIT-TO-SCREEN
   *
   * The iframe keeps its REAL viewport dimensions.
   *
   * Only the visual frame is scaled so the entire viewport
   * fits inside the available preview area.
   * =========================================================
   */

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const calculateScale = () => {
      const stageWidth = stage.clientWidth;
      const stageHeight = stage.clientHeight;

      if (!stageWidth || !stageHeight) return;

      const horizontalPadding = 28;
      const verticalPadding = 28;

      const availableWidth =
        Math.max(
          stageWidth - horizontalPadding,
          1
        );

      const availableHeight =
        Math.max(
          stageHeight - verticalPadding,
          1
        );

      const frameWidth =
        selectedDevice.width;

      const frameHeight =
        selectedDevice.height + 32;

      const widthScale =
        availableWidth / frameWidth;

      const heightScale =
        availableHeight / frameHeight;

      const nextScale = Math.min(
        1,
        widthScale,
        heightScale
      );

      setScale(
        Number(
          Math.max(nextScale, 0.05).toFixed(4)
        )
      );
    };

    calculateScale();

    const observer =
      new ResizeObserver(calculateScale);

    observer.observe(stage);

    window.addEventListener(
      "resize",
      calculateScale
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "resize",
        calculateScale
      );
    };
  }, [
    selectedDevice.width,
    selectedDevice.height,
  ]);

  const handleDeviceChange = (id) => {
    setSelectedId(id);
    setReloadKey((value) => value + 1);
  };

  const handleRefresh = () => {
    setReloadKey((value) => value + 1);
  };

  const handleOpenApp = () => {
    window.location.href = "/";
  };

  return (
    <div className="responsive-preview">

      <header className="responsive-preview-header">

        <div className="responsive-preview-brand">
          <div className="responsive-preview-logo">
            U
          </div>

          <div>
            <strong>UpTrend</strong>
            <span>Responsive Preview</span>
          </div>
        </div>

        <div className="responsive-preview-current">
          <span className="responsive-preview-live-dot" />

          <strong>
            {selectedDevice.label}
          </strong>

          <span>
            {selectedDevice.width} ×{" "}
            {selectedDevice.height}
          </span>

          <span className="responsive-preview-scale">
            {Math.round(scale * 100)}%
          </span>
        </div>

        <div className="responsive-preview-actions">
          <button
            type="button"
            onClick={handleRefresh}
            className="responsive-preview-button"
          >
            ↻ Refresh
          </button>

          <button
            type="button"
            onClick={handleOpenApp}
            className="responsive-preview-button primary"
          >
            Open UpTrend
          </button>
        </div>

      </header>

      <nav className="responsive-preview-toolbar">
        <div className="responsive-preview-device-list">
          {DEVICE_PRESETS.map((device) => (
            <button
              key={device.id}
              type="button"
              className={`responsive-device-button ${
                selectedId === device.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleDeviceChange(device.id)
              }
            >
              <span className="device-short-label">
                {device.shortLabel}
              </span>

              <span className="device-size">
                {device.width} × {device.height}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <main className="responsive-preview-workspace">

        <div className="responsive-preview-info">
          <div>
            <strong>
              Real responsive viewport
            </strong>

            <span>
              The page keeps its real{" "}
              {selectedDevice.width}px ×{" "}
              {selectedDevice.height}px viewport.
              The preview automatically scales to fit
              your available screen.
            </span>
          </div>

          <span className="responsive-preview-breakpoint">
            viewport: {selectedDevice.width}px
          </span>
        </div>

        <div
          ref={stageRef}
          className="responsive-preview-stage"
        >

          <div
            className={`responsive-device-frame ${selectedDevice.id}`}
            style={{
              "--preview-width":
                `${selectedDevice.width}px`,
              "--preview-height":
                `${selectedDevice.height}px`,
              "--preview-scale":
                scale,
            }}
          >

            <div className="responsive-device-topbar">
              <span />
              <strong>
                {selectedDevice.label}
              </strong>
              <span />
            </div>

            <div className="responsive-device-viewport">
              <iframe
                key={reloadKey}
                title={`UpTrend ${selectedDevice.label} preview`}
                src="/"
                className="responsive-preview-iframe"
              />
            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

export default ResponsivePreview;
