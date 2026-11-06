// Clueboard's OWN Firebase project, never the buzzer's: the two share no rules document, and
// publishing one project's rules over the other's takes a live lesson down.
// Re-print these with: npx firebase-tools apps:sdkconfig WEB
// Public by design - these identify the project, they do not grant anything. What protects
// the data is database.rules.json.
const firebaseConfig = {
  apiKey: "AIzaSyCHCBDwQuab6CrDHyDry4IeFJkB5Kr-0eE",
  authDomain: "clueboard-52d066.firebaseapp.com",
  databaseURL: "https://clueboard-52d066-default-rtdb.firebaseio.com",
  projectId: "clueboard-52d066",
  storageBucket: "clueboard-52d066.firebasestorage.app",
  messagingSenderId: "164050101014",
  appId: "1:164050101014:web:36bd99ebe19ea744ada637"
};
