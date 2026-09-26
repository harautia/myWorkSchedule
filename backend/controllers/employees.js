const employeesRouter = require('express').Router()
const Employees = require('../models/employees')
const Users = require('../models/users')
const { requireGroup } = require('../utils/middleware')
const { MANAGER } = require('../utils/groups')

// Name, role and colour of everyone in the bar, needed to show the schedule.
employeesRouter.get('/', async (request, response) => {
  const employees = await Employees.getAll(request.barId)
  response.json(employees)
})

// Managers only: employees together with their login account, if any.
employeesRouter.get('/details', requireGroup(MANAGER), async (request, response) => {
  const [employees, accounts] = await Promise.all([
    Employees.getAll(request.barId),
    Users.accountsByEmployee(request.barId)
  ])
  response.json(employees.map((employee) => ({ ...employee, account: accounts.get(employee.id) ?? null })))
})

module.exports = employeesRouter
