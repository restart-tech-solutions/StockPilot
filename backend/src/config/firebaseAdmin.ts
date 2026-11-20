import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import path from "path";
import fs from "fs";

function resolveServiceAccount(): string | undefined {
  const possiblePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.resolve(process.cwd(), "private/firebase-service-account.json"),
    path.resolve(process.cwd(), "backend/private/firebase-service-account.json"),
    path.resolve(__dirname, "../../private/firebase-service-account.json"),
    path.resolve(__dirname, "../../../backend/private/firebase-service-account.json"),
  ];

  for (const candidate of possiblePaths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

let firebaseApp: App;
const serviceAccountPath = resolveServiceAccount();

if (getApps().length > 0) {
  firebaseApp = getApps()[0];
} else if (serviceAccountPath) {
  firebaseApp = initializeApp({
    credential: cert(serviceAccountPath),
    projectId: "stockpilot-5b992",
  });
} else {
  firebaseApp = initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || "stockpilot-5b992",
  });
}

export const firebaseAdmin = firebaseApp;
export const firebaseAuth: Auth = getAuth(firebaseApp);
