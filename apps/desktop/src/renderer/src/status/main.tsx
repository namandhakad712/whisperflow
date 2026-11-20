import { createRoot } from "react-dom/client";
import { StatusBar } from "./StatusBar";

// No shared styles.css: it paints `body` with the settings app's opaque
// background, which would cover this transparent window and hide the dash and
// the hover capsule (that was the "resting pill doesn't show" bug — captured
// as an opaque light bar filling the whole hit zone).
createRoot(document.getElementById("root")!).render(<StatusBar />);
