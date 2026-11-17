const weekdayIds = [1, 2, 3, 4, 5, 6, 0]
const weekdayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export const defaultForecastSettings = {
  schools: {
    MIAGE: { weekdays: [1, 2, 3, 4, 5], hoursPerDay: 1.5 },
    ECIG: { weekdays: [1, 2, 3, 4, 5], hoursPerDay: 1.5 },
  },
  holidays: [],
}

export function moroccoFixedHolidays(year) {
  // Dates fixes publiées sur le portail officiel marocain : https://maroc.ma/fr/le-maroc/fetes-nationales-et-religieuses
  const holidays = [
    ['01-01', 'Nouvel an'],
    ['01-11', 'Manifeste de l’indépendance'],
    ['01-14', 'Nouvel an amazigh'],
    ['05-01', 'Fête du Travail'],
    ['07-30', 'Fête du Trône'],
    ['08-14', 'Récupération de Oued Eddahab'],
    ['08-20', 'Révolution du Roi et du Peuple'],
    ['08-21', 'Fête de la Jeunesse'],
    ['11-06', 'Marche Verte'],
    ['11-18', 'Fête de l’Indépendance'],
  ]
  if (year >= 2026) holidays.push(['10-31', 'Fête de l’Unité'])
  return holidays.map(([day, name]) => ({ date: `${year}-${day}`, name, school: 'Tous', national: true }))
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function calculateMonthlyForecast({ month, today, rows, settings, schools }) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  const monthDates = Array.from({ length: lastDay }, (_, index) => new Date(year, monthNumber - 1, index + 1))
  const monthRows = rows.filter(row => row.date.startsWith(month))

  return Object.entries(schools).map(([name, school]) => {
    const schedule = settings.schools[name] || defaultForecastSettings.schools[name]
    const schoolRows = monthRows.filter(row => row.school === name)
    const actualHours = schoolRows.reduce((sum, row) => sum + Number(row.duration || 0), 0)
    const actualDays = new Set(schoolRows.map(row => row.date))
    const nationalHolidays = moroccoFixedHolidays(year)
    const holidayDates = new Set([...nationalHolidays, ...settings.holidays]
      .filter(holiday => holiday.school === name || holiday.school === 'Tous')
      .map(holiday => holiday.date))
    const workDates = monthDates.filter(date => schedule.weekdays.includes(date.getDay()) && !holidayDates.has(dateKey(date)))
    const expectedDays = workDates.filter(date => dateKey(date) >= today && !actualDays.has(dateKey(date))).length
    const expectedHours = expectedDays * Number(schedule.hoursPerDay || 0)

    return {
      name,
      rate: school.rate,
      workDays: workDates.length,
      actualDays: workDates.filter(date => actualDays.has(dateKey(date))).length,
      expectedDays,
      actualHours,
      expectedHours,
      actualAmount: actualHours * school.rate,
      projectedAmount: expectedHours * school.rate,
      totalAmount: (actualHours + expectedHours) * school.rate,
      schedule,
    }
  })
}

export { weekdayIds, weekdayLabels }
