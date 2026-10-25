import 'server-only'

import {
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app'

import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccountJson =
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()

let projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
let clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY

if (serviceAccountJson) {
  try {
    const serviceAccount = JSON.parse(
      serviceAccountJson
    ) as {
      project_id?: string
      client_email?: string
      private_key?: string
    }

    projectId = serviceAccount.project_id
    clientEmail = serviceAccount.client_email
    privateKey = serviceAccount.private_key
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY contains invalid JSON.'
    )
  }
}

privateKey = privateKey?.replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    'Missing Firebase Admin environment variables.'
  )
}

const app =
  getApps().find((existingApp) => existingApp.name === '[DEFAULT]') ||
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)