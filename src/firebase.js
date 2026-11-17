import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { collection, deleteDoc, doc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const firebaseReady = Object.values(config).every(Boolean)
let db
let userId
let authReady = Promise.resolve()
if (firebaseReady) {
  const app = initializeApp(config)
  const auth = getAuth(app)
  db = getFirestore(app)
  authReady = signInAnonymously(auth).then(credential => { userId = credential.user.uid })
}

const localKey = 'trackhours-attendances-v1'
const forecastKey = 'trackhours-forecast-settings-v1'
export function subscribeAttendances(callback, onError) {
  if (firebaseReady) {
    let unsubscribe
    let cancelled = false
    authReady.then(() => { if (!cancelled) unsubscribe = onSnapshot(collection(db, 'users', userId, 'attendances'), snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date.localeCompare(a.date))), onError) }).catch(onError)
    return () => { cancelled = true; unsubscribe?.() }
  }
  const read = () => callback(JSON.parse(localStorage.getItem(localKey) || '[]').sort((a, b) => b.date.localeCompare(a.date)))
  read()
  const listener = e => { if (e.key === localKey) read() }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
export async function saveAttendance(item) {
  if (firebaseReady) { await authReady; return setDoc(doc(db, 'users', userId, 'attendances', item.id), item) }
  const rows = JSON.parse(localStorage.getItem(localKey) || '[]')
  const idx = rows.findIndex(row => row.id === item.id)
  if (idx < 0) rows.push(item); else rows[idx] = item
  localStorage.setItem(localKey, JSON.stringify(rows))
  window.dispatchEvent(new StorageEvent('storage', { key: localKey }))
}
export async function removeAttendance(id) {
  if (firebaseReady) { await authReady; return deleteDoc(doc(db, 'users', userId, 'attendances', id)) }
  localStorage.setItem(localKey, JSON.stringify(JSON.parse(localStorage.getItem(localKey) || '[]').filter(row => row.id !== id)))
  window.dispatchEvent(new StorageEvent('storage', { key: localKey }))
}

export function subscribeForecastSettings(callback, onError) {
  if (firebaseReady) {
    let unsubscribe
    let cancelled = false
    authReady.then(() => {
      if (!cancelled) unsubscribe = onSnapshot(doc(db, 'users', userId, 'settings', 'forecast'), snap => callback(snap.exists() ? snap.data() : null), onError)
    }).catch(onError)
    return () => { cancelled = true; unsubscribe?.() }
  }
  const read = () => {
    try { callback(JSON.parse(localStorage.getItem(forecastKey) || 'null')) }
    catch { callback(null) }
  }
  read()
  const listener = event => { if (event.key === forecastKey) read() }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}

export async function saveForecastSettings(settings) {
  if (firebaseReady) {
    await authReady
    return setDoc(doc(db, 'users', userId, 'settings', 'forecast'), settings)
  }
  localStorage.setItem(forecastKey, JSON.stringify(settings))
  window.dispatchEvent(new StorageEvent('storage', { key: forecastKey }))
}
