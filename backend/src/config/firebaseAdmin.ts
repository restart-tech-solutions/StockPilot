
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import path from "path";
import fs from "fs";

function getFirebaseCredentials() {
  const jsonCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (jsonCredentials) {
    try {
      return JSON.parse(jsonCredentials);
    } catch {
      throw new Error(
        "Invalid FIREBASE_SERVICE_ACCOUNT_JSON environment variable"
      );
    }
  }

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

const credentials = getFirebaseCredentials();

if (getApps().length > 0) {
  firebaseApp = getApps()[0];
} else if (credentials) {
  firebaseApp = initializeApp({
    credential:
      typeof credentials === "string"
        ? cert(credentials)
        : cert(credentials),
    projectId: process.env.FIREBASE_PROJECT_ID || "stockpilot-5b992",
  });
} else {
  throw new Error(
    "Firebase credentials missing. Configure FIREBASE_SERVICE_ACCOUNT_JSON."
  );
}

export const firebaseAdmin = firebaseApp;
export const firebaseAuth: Auth = getAuth(firebaseApp);
