/*
 * Firebase browser bootstrap.
 *
 * The Firebase web config identifies the project; it is not an administrator
 * credential. Access is restricted by Firebase Authentication plus the
 * Firestore and Storage rules included with this project.
 */
const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyCJHwDxf-IZYu08gUkMk5HIns1jHKrLA3w",
  authDomain: "weight-track-app-e0e2c.firebaseapp.com",
  projectId: "weight-track-app-e0e2c",
  storageBucket: "weight-track-app-e0e2c.firebasestorage.app",
  messagingSenderId: "511648794081",
  appId: "1:511648794081:web:3eee3f5b78c6c1083cbea0"
});

const FIREBASE_SDK_VERSION = "12.15.0";
const FIREBASE_CDN_ROOT = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

window.firebaseReadyPromise = (async () => {
  const [appApi, authApi, firestoreApi, storageApi] = await Promise.all([
    import(`${FIREBASE_CDN_ROOT}/firebase-app.js`),
    import(`${FIREBASE_CDN_ROOT}/firebase-auth.js`),
    import(`${FIREBASE_CDN_ROOT}/firebase-firestore.js`),
    import(`${FIREBASE_CDN_ROOT}/firebase-storage.js`)
  ]);

  const app = appApi.initializeApp(FIREBASE_CONFIG);
  const auth = authApi.getAuth(app);
  try {
    await authApi.setPersistence(auth, authApi.browserLocalPersistence);
  } catch (error) {
    console.warn("Firebase Auth persistence could not be enabled:", error);
  }

  const db = firestoreApi.getFirestore(app);
  const storage = storageApi.getStorage(app);

  const services = {
    app,
    auth,
    db,
    storage,
    appApi,
    authApi,
    firestoreApi,
    storageApi
  };

  window.firebaseServices = services;
  window.dispatchEvent(new CustomEvent("korean-reader-firebase-ready", {detail: services}));
  return services;
})().catch((error) => {
  console.error("Firebase could not be initialized:", error);
  window.dispatchEvent(new CustomEvent("korean-reader-firebase-error", {detail: error}));
  throw error;
});
