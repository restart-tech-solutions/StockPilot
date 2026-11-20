import { AuthProvider } from "../features/auth/authContext";
import { WorkspaceProvider } from "../features/workspace/workspaceContext";
import { AppRouter } from "./router";

export function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AppRouter />
      </WorkspaceProvider>
    </AuthProvider>
  );
}
