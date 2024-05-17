import { FC } from "react";
import { Tldraw, TldrawProps } from "tldraw";
import "tldraw/tldraw.css";

const TldrawEditor: FC<TldrawProps> = ({ ...props }) => {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw autoFocus {...props} />;
    </div>
  );
};

export default TldrawEditor;
