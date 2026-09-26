const employeesRouter = require('express').Router()
const Employees = require('../models/employees')

employeesRouter.get('/', async (request, response) => {
  const employees = await Employees.getAll(request.barId)
  response.json(employees)
})

module.exports = employeesRouter
