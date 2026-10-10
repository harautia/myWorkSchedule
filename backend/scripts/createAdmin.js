// Creates a platform admin: the first account of a new installation, which
// then creates bars and their managers in the app.
//
//   npm run create-admin -- --username admin --name "Your Name" [--email you@example.com]
//
// The password is asked for (not shown while typing), or read from the
// ADMIN_PASSWORD environment variable for scripted setups.
const readline = require('readline')
const db = require('../db/db')
const Users = require('../models/users')
const { hashPassword } = require('../utils/passwords')
const { newAccountError } = require('../utils/validation')

const argument = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

// Reads a line without echoing it.
const askHidden = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) rl.output.write(text)
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })

const main = async () => {
  const username = argument('username')?.trim().toLowerCase()
  const name = argument('name')?.trim()
  const email = argument('email')?.trim().toLowerCase()
  if (!username || !name) {
    console.error('Usage: npm run create-admin -- --username <username> --name "<full name>" [--email <email>]')
    return 1
  }

  let password = process.env.ADMIN_PASSWORD
  if (!password) {
    if (!process.stdin.isTTY) {
      console.error('Set ADMIN_PASSWORD, or run this in a terminal to be asked for the password.')
      return 1
    }
    password = await askHidden('Password: ')
    if ((await askHidden('Password again: ')) !== password) {
      console.error('The passwords don\'t match.')
      return 1
    }
  }

  const error = newAccountError({ username, name, password, email })
  if (error) {
    console.error(`Can't create the admin: ${error}`)
    return 1
  }
  if (await Users.usernameTaken(username)) {
    console.error(`The username ${username} is already in use.`)
    return 1
  }

  if (email && await Users.emailTaken(email)) {
    console.error(`The email ${email} is already in use.`)
    return 1
  }

  await Users.create({ isAdmin: true, username, email, name, passwordHash: await hashPassword(password) })
  console.log(`Admin ${username} created. Log in to the app to create bars and their managers.`)
  return 0
}

main()
  .then((code) => { process.exitCode = code })
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => db.destroy())
