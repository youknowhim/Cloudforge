import Icon from "../Icon/Icon";

import "./Loader.css";

interface LoaderProps {
  text?: string;
  size?: number;
  fullscreen?: boolean;
}

const Loader = ({ text, size = 18, fullscreen = false }: LoaderProps) => (
  <div className={`loader${fullscreen ? " loader--fullscreen" : ""}`}>
    <Icon name="spinner" size={size} strokeWidth={2} className="spin" />

    {text && <span>{text}</span>}
  </div>
);

export default Loader;
