import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import cors from 'cors'

admin.initializeApp()

const corsHandler = cors({ origin: true })

// Placeholder function
export const helloWorld = functions.https.onRequest((req, res) => {
  corsHandler(req, res, () => {
    res.json({ message: 'Sistema de OS - Firebase Functions' })
  })
})

// TODO: Functions para eNota, relatórios, etc.
