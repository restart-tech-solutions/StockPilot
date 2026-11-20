import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface Workspace {
  id: string;
  businessName: string;
  ownerId?: string;
  contactDetails?: {
    email?: string;
    phone?: string;
  };
  category: string;
  location: string;
  currency: string;
  membershipRole?: string;
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  setWorkspace: (workspace: Workspace | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredWorkspace(): Workspace | null {
  const value = window.localStorage.getItem("stockpilot_workspace");
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Workspace;
  } catch {
    window.localStorage.removeItem("stockpilot_workspace");
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspaceState] =
    useState<Workspace | null>(readStoredWorkspace);

  const setWorkspace = useCallback((nextWorkspace: Workspace | null) => {
    setWorkspaceState(nextWorkspace);
    if (nextWorkspace) {
      window.localStorage.setItem(
        "stockpilot_workspace",
        JSON.stringify(nextWorkspace)
      );
    } else {
      window.localStorage.removeItem("stockpilot_workspace");
    }
  }, []);

  const value = useMemo(
    () => ({ workspace, setWorkspace }),
    [workspace, setWorkspace]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
