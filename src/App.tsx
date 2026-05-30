import { AppWorkspace } from "./features/appMode/AppWorkspace";
import { AppTitleBar } from "./features/window/AppTitleBar";

function App() {
  return (
    <>
      <AppTitleBar />
      <AppWorkspace />
    </>
  );
}

export default App;
