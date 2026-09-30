// Colours given to employees created by the app (e.g. a new manager).
// Chosen to stay readable as shift backgrounds and distinct from each other.
const EMPLOYEE_COLORS = [
  '#863bff', '#1c7ed6', '#0ca678', '#e8590c', '#d6336c', '#5c940d',
  '#c2255c', '#1971c2', '#e67700', '#2b8a3e', '#7048e8', '#0b7285'
]

// The first palette colour nobody in usedColors has; cycles when all are taken.
const pickColor = (usedColors) => {
  const used = new Set(usedColors.map((color) => color.toLowerCase()))
  return EMPLOYEE_COLORS.find((color) => !used.has(color)) ?? EMPLOYEE_COLORS[usedColors.length % EMPLOYEE_COLORS.length]
}

module.exports = { EMPLOYEE_COLORS, pickColor }
